import os
import json
import datetime
import requests
import re
from noaa_coops import Station

def fetch_tide_data(station_id, units, datum):
    # Find the web output directory relative to this package script location
    # script: src/tide_clock/scraper.py -> web_dir: src/../web
    package_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(os.path.dirname(package_dir))
    web_dir = os.path.join(root_dir, "web")
    
    # Ensure web directory exists (just in case)
    os.makedirs(web_dir, exist_ok=True)
    output_path = os.path.join(web_dir, "tide_data.json")

    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Scraping station {station_id} ({units}, {datum})...")
    
    station = Station(id=station_id)
    station_name = getattr(station, "name", f"Station {station_id}")

    # Fetch 3 days of predictions (yesterday, today, tomorrow) to support three tide cycles display
    now = datetime.datetime.now()
    begin_date = (now - datetime.timedelta(days=1)).strftime("%Y%m%d")
    end_date = (now + datetime.timedelta(days=2)).strftime("%Y%m%d")
    
    df = station.get_data(
        begin_date=begin_date,
        end_date=end_date,
        product="predictions",
        datum=datum,
        units=units,
        time_zone="lst_ldt"
    )

    # We sample once per hour to keep the JSON payload lightweight
    df_hourly = df.resample("h").first()

    tide_heights = []
    for dt, row in df_hourly.iterrows():
        val = row["v"]
        tide_heights.append({
            "time": dt.isoformat(),
            "value": round(val, 3)
        })

    # Fetch exact high/low tide predictions (hilo)
    tide_extremes = []
    try:
        df_hilo = station.get_data(
            begin_date=begin_date,
            end_date=end_date,
            product="predictions",
            datum=datum,
            units=units,
            time_zone="lst_ldt",
            interval="hilo"
        )
        for dt, row in df_hilo.iterrows():
            tide_extremes.append({
                "time": dt.isoformat(),
                "value": round(float(row["v"]), 3),
                "type": str(row["type"]) # 'H' or 'L'
            })
    except Exception as e:
        print(f"Scraper: Warning: failed to fetch exact tide extremes: {e}")

    # Fetch predicted currents data for nearby station CAB1401 (Portland Harbor Entrance)
    current_predictions = []
    try:
        currents_url = (
            f"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
            f"?product=currents_predictions&station=CAB1401"
            f"&begin_date={begin_date}&end_date={end_date}"
            f"&units=english&time_zone=lst_ldt&format=json"
        )
        res_curr = requests.get(currents_url, timeout=10)
        if res_curr.status_code == 200:
            curr_json = res_curr.json()
            if "current_predictions" in curr_json:
                cps = curr_json["current_predictions"]["cp"]
                for idx in range(0, len(cps), 10):
                    item = cps[idx]
                    current_predictions.append({
                        "time": item["Time"].replace(" ", "T"),
                        "value": round(float(item["Velocity_Major"]), 2)
                    })
    except Exception as e:
        print(f"Scraper: Warning: failed to fetch predicted currents: {e}")

    # Determine station's local current day by applying metadata timezone offset to UTC
    tz_offset_hours = int(station.metadata.get("timezonecorr", 0))
    utc_now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    station_local_now = utc_now + datetime.timedelta(hours=tz_offset_hours)
    station_today = station_local_now.date()



    # Fetch water temperature (latest reading)
    water_temp = None
    try:
        temp_begin = (now - datetime.timedelta(days=1)).strftime("%Y%m%d")
        temp_end = now.strftime("%Y%m%d")
        df_temp = station.get_data(
            begin_date=temp_begin,
            end_date=temp_end,
            product="water_temperature",
            units=units,
            time_zone="lst_ldt"
        )
        if not df_temp.empty:
            valid_temps = df_temp["v"].dropna()
            if not valid_temps.empty:
                water_temp = round(float(valid_temps.iloc[-1]), 1)
    except Exception as e:
        print(f"Scraper: Warning: failed to fetch water temperature: {e}")

    # Fetch NWS Coastal Waters Forecast for Casco Bay
    nws_office = "GYX"
    nws_zone = "ANZ153"
    try:
        config_path = os.path.join(root_dir, "tide_config.json")
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                cfg = json.load(f)
                nws_office = cfg.get("nws_office", "GYX")
                nws_zone = cfg.get("nws_zone", "ANZ153")
    except Exception as e:
        print(f"Scraper: Warning: failed to load NWS config parameters: {e}")

    marine_forecast = []
    try:
        nws_headers = {"User-Agent": "(marine-kiosk-dashboard, brian@example.com)"}
        
        # 1. Fetch latest CWF products from the office
        url_list = f"https://api.weather.gov/products/types/CWF/locations/{nws_office}"
        res_list = requests.get(url_list, headers=nws_headers, timeout=10)
        if res_list.status_code == 200:
            graph = res_list.json().get("@graph", [])
            if graph:
                latest_product_id = graph[0].get("id")
                
                # 2. Fetch the text content of the product
                url_prod = f"https://api.weather.gov/products/{latest_product_id}"
                res_prod = requests.get(url_prod, headers=nws_headers, timeout=10)
                if res_prod.status_code == 200:
                    product_text = res_prod.json().get("productText", "")
                    
                    # 3. Extract the zone segment using regex
                    pattern = rf"({nws_zone}-.*?)\$\$"
                    match = re.search(pattern, product_text, re.DOTALL)
                    if match:
                        extracted = match.group(1).strip()
                        
                        # 4. Parse periods
                        periods_raw = re.findall(
                            r"\.([A-Z0-9\s]+)\.\.\.(.*?)(?=\s*\.[A-Z0-9\s]+\.\.\.|\s*$)",
                            extracted,
                            re.DOTALL
                        )
                        for period_name, period_text in periods_raw:
                            clean_text = re.sub(r"\s+", " ", period_text.strip())
                            marine_forecast.append({
                                "name": period_name.strip(),
                                "text": clean_text
                            })
                    else:
                        print(f"Scraper: Warning: could not find NWS zone segment for {nws_zone}")
        else:
            print(f"Scraper: Warning: failed to fetch NWS CWF product list: {res_list.status_code}")
    except Exception as e:
        print(f"Scraper: Warning: failed to fetch NWS marine forecast: {e}")

    output_data = {
        "station_id": station_id,
        "station_name": station_name,
        "date": station_today.strftime("%Y-%m-%d"),
        "units": units,
        "datum": datum,
        "timezone": station.metadata.get("timezone", "LST"),
        "water_temp": water_temp,
        "marine_forecast": marine_forecast,
        "tide_heights": tide_heights,
        "tide_extremes": tide_extremes,
        "current_predictions": current_predictions,
        "last_updated": now.isoformat()
    }

    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)

    print(f"Scraper: Successfully saved tide data to {output_path}")

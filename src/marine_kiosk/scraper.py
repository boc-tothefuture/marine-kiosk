import os
import json
import datetime
import requests
import re
from noaa_coops import Station

def fetch_tide_data(station_id, units, datum, config_path=None):
    # Find the web output directory relative to this package script location
    # script: src/tide_clock/scraper.py -> web_dir: src/../web
    package_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(os.path.dirname(package_dir))
    web_dir = os.path.join(root_dir, "web")
    
    if config_path is None:
        config_path = os.path.join(root_dir, "tide_config.json")
    
    # Ensure web directory exists (just in case)
    os.makedirs(web_dir, exist_ok=True)
    output_path = os.path.join(web_dir, "tide_data.json")

    # Load configuration parameters
    cfg = {}
    try:
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                cfg = json.load(f)
    except Exception as e:
        print(f"Scraper: Warning: failed to load config at startup: {e}")

    astral_lat = cfg.get("astral_latitude")
    astral_lng = cfg.get("astral_longitude")
    astral_elev = cfg.get("astral_elevation", 0.0)
    currents_station_id = cfg.get("currents_station_id", "CAB1401")
    nws_office = cfg.get("nws_office", "GYX")
    nws_zone = cfg.get("nws_zone", "ANZ153")

    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Scraping station {station_id} ({units}, {datum})...")
    
    station = Station(id=station_id)
    raw_station_name = getattr(station, "name", f"Station {station_id}")
    station_name = raw_station_name.split(",")[0].strip() if "," in raw_station_name else raw_station_name
    station_name = station_name.replace(" IS.", " ISLAND").replace(" PT.", " POINT").replace(" ENT.", " ENTRANCE")
    output_station_id = station_id

    # Check if this is a subordinate station using NOAA Metadata API
    ref_station_id = station_id
    is_subordinate = False
    time_offset_high = 0
    time_offset_low = 0
    height_offset_high = 0.0
    height_offset_low = 0.0
    height_adj_type = "R"
    
    try:
        offsets_url = f"https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/{station_id}/tidepredoffsets.json"
        res_offsets = requests.get(offsets_url, timeout=10)
        if res_offsets.status_code == 200:
            offsets_data = res_offsets.json()
            parent_ref = offsets_data.get("refStationId")
            if parent_ref:
                ref_station_id = parent_ref
                is_subordinate = True
                time_offset_high = offsets_data.get("timeOffsetHighTide") or 0
                time_offset_low = offsets_data.get("timeOffsetLowTide") or 0
                height_adj_type = offsets_data.get("heightAdjustedType") or "R"
                
                default_h_high = 1.0 if height_adj_type == "R" else 0.0
                default_h_low = 1.0 if height_adj_type == "R" else 0.0
                
                height_offset_high = offsets_data.get("heightOffsetHighTide")
                if height_offset_high is None:
                    height_offset_high = default_h_high
                height_offset_low = offsets_data.get("heightOffsetLowTide")
                if height_offset_low is None:
                    height_offset_low = default_h_low
                    
                print(f"Scraper: Detected subordinate station {station_id}. Using reference station {ref_station_id} with offsets: "
                      f"time high={time_offset_high}m, low={time_offset_low}m, height type={height_adj_type}, high={height_offset_high}, low={height_offset_low}")
    except Exception as e:
        print(f"Scraper: Warning: failed to fetch tide offsets for station {station_id}: {e}")

    if is_subordinate:
        ref_station = Station(id=ref_station_id)
    else:
        ref_station = station

    # Fetch 3 days of predictions (yesterday, today, tomorrow) to support three tide cycles display
    now = datetime.datetime.now()
    begin_date = (now - datetime.timedelta(days=1)).strftime("%Y%m%d")
    end_date = (now + datetime.timedelta(days=2)).strftime("%Y%m%d")
    
    df = ref_station.get_data(
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
        df_hilo = ref_station.get_data(
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

    # Apply subordinate adjustments if active
    if is_subordinate:
        # 1. Adjust tide extremes
        adjusted_extremes = []
        tide_extremes_parsed = []
        for ext in tide_extremes:
            ext_time = datetime.datetime.fromisoformat(ext["time"])
            if ext["type"] == "H":
                adjusted_time = ext_time + datetime.timedelta(minutes=time_offset_high)
                if height_adj_type == "R":
                    adjusted_val = ext["value"] * height_offset_high
                else:
                    adjusted_val = ext["value"] + height_offset_high
            else:
                adjusted_time = ext_time + datetime.timedelta(minutes=time_offset_low)
                if height_adj_type == "R":
                    adjusted_val = ext["value"] * height_offset_low
                else:
                    adjusted_val = ext["value"] + height_offset_low
            
            adjusted_extremes.append({
                "time": adjusted_time.isoformat(),
                "value": round(adjusted_val, 3),
                "type": ext["type"]
            })
            tide_extremes_parsed.append({
                "time": adjusted_time,
                "value": adjusted_val,
                "type": ext["type"]
            })
        tide_extremes = adjusted_extremes
        tide_extremes_parsed.sort(key=lambda x: x["time"])

        # 2. Adjust hourly predictions by interpolating offsets between adjusted extremes
        adjusted_heights = []
        for pt in tide_heights:
            pt_time = datetime.datetime.fromisoformat(pt["time"])
            val = pt["value"]
            
            if tide_extremes_parsed:
                # Find closest previous and next extremes in the adjusted extremes list
                prev_ext = None
                next_ext = None
                for ext in tide_extremes_parsed:
                    if ext["time"] <= pt_time:
                        prev_ext = ext
                    if ext["time"] >= pt_time and next_ext is None:
                        next_ext = ext
                        break
                
                if prev_ext is None and next_ext is None:
                    adjusted_val = val
                    adjusted_time = pt_time
                elif prev_ext is None:
                    t_off = time_offset_high if next_ext["type"] == "H" else time_offset_low
                    h_off = height_offset_high if next_ext["type"] == "H" else height_offset_low
                    adjusted_time = pt_time + datetime.timedelta(minutes=t_off)
                    adjusted_val = val * h_off if height_adj_type == "R" else val + h_off
                elif next_ext is None:
                    t_off = time_offset_high if prev_ext["type"] == "H" else time_offset_low
                    h_off = height_offset_high if prev_ext["type"] == "H" else height_offset_low
                    adjusted_time = pt_time + datetime.timedelta(minutes=t_off)
                    adjusted_val = val * h_off if height_adj_type == "R" else val + h_off
                else:
                    t_prev = prev_ext["time"]
                    t_next = next_ext["time"]
                    total_sec = (t_next - t_prev).total_seconds()
                    if total_sec > 0:
                        factor = (pt_time - t_prev).total_seconds() / total_sec
                    else:
                        factor = 0.5
                    
                    t_off_p = time_offset_high if prev_ext["type"] == "H" else time_offset_low
                    t_off_n = time_offset_high if next_ext["type"] == "H" else time_offset_low
                    h_off_p = height_offset_high if prev_ext["type"] == "H" else height_offset_low
                    h_off_n = height_offset_high if next_ext["type"] == "H" else height_offset_low
                    
                    int_t_off = (1 - factor) * t_off_p + factor * t_off_n
                    int_h_off = (1 - factor) * h_off_p + factor * h_off_n
                    
                    adjusted_time = pt_time + datetime.timedelta(minutes=int_t_off)
                    if height_adj_type == "R":
                        adjusted_val = val * int_h_off
                    else:
                        adjusted_val = val + int_h_off
            else:
                adjusted_time = pt_time
                adjusted_val = val
                
            adjusted_heights.append({
                "time": adjusted_time.isoformat(),
                "value": round(adjusted_val, 3)
            })
        tide_heights = adjusted_heights

    # Fetch predicted currents data
    current_predictions = []
    try:
        currents_url = (
            f"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
            f"?product=currents_predictions&station={currents_station_id}"
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
        temp_station = station
        try:
            df_temp = temp_station.get_data(
                begin_date=temp_begin,
                end_date=temp_end,
                product="water_temperature",
                units=units,
                time_zone="lst_ldt"
            )
        except Exception as e:
            if is_subordinate:
                print(f"Scraper: Water temp not available for subordinate station. Falling back to reference station {ref_station_id}...")
                temp_station = ref_station
                df_temp = temp_station.get_data(
                    begin_date=temp_begin,
                    end_date=temp_end,
                    product="water_temperature",
                    units=units,
                    time_zone="lst_ldt"
                )
            else:
                raise e
        if not df_temp.empty:
            valid_temps = df_temp["v"].dropna()
            if not valid_temps.empty:
                water_temp = round(float(valid_temps.iloc[-1]), 1)
    except Exception as e:
        print(f"Scraper: Warning: failed to fetch water temperature: {e}")

    # Fetch NWS Coastal Waters Forecast for Casco Bay

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

    # Calculate highly accurate sunrise, sunset, moonrise, moonset using astral
    astronomical_data = {}
    try:
        from astral import Observer
        from astral.sun import sun
        from astral.moon import moonrise, moonset, phase

        # Use configured coordinates if defined, otherwise fallback to station metadata coordinates
        lat = float(astral_lat if astral_lat is not None else station.metadata.get("lat", 43.658))
        lng = float(astral_lng if astral_lng is not None else station.metadata.get("lng", -70.244))
        elev = float(astral_elev)
        
        observer = Observer(lat, lng, elev)
        
        # Get offset timezone
        tz_offset_hours = int(station.metadata.get("timezonecorr", 0))
        tz = datetime.timezone(datetime.timedelta(hours=tz_offset_hours))

        for i in range(-1, 3):
            check_date = (now + datetime.timedelta(days=i)).date()
            date_key = check_date.isoformat()
            
            # Sun
            sunrise_str = None
            sunset_str = None
            try:
                s = sun(observer, check_date, tzinfo=tz)
                sunrise_str = s["sunrise"].isoformat()
                sunset_str = s["sunset"].isoformat()
            except Exception as e:
                print(f"Scraper: Sun calculation failed for {date_key}: {e}")

            # Moonrise
            moonrise_str = None
            try:
                mr = moonrise(observer, check_date, tz)
                if mr:
                    moonrise_str = mr.isoformat()
            except Exception as e:
                pass

            # Moonset
            moonset_str = None
            try:
                ms = moonset(observer, check_date, tz)
                if ms:
                    moonset_str = ms.isoformat()
            except Exception as e:
                pass

            # Moon Phase
            p_val = 0.0
            p_name = "New Moon"
            p_symbol = "🌑"
            try:
                p_val = phase(check_date)
                if p_val < 1.0 or p_val > 28.53:
                    p_name, p_symbol = "New Moon", "🌑"
                elif p_val < 6.38:
                    p_name, p_symbol = "Waxing Crescent", "🌒"
                elif p_val < 8.38:
                    p_name, p_symbol = "First Quarter", "🌓"
                elif p_val < 13.76:
                    p_name, p_symbol = "Waxing Gibbous", "🌔"
                elif p_val < 15.76:
                    p_name, p_symbol = "Full Moon", "🌕"
                elif p_val < 21.14:
                    p_name, p_symbol = "Waning Gibbous", "🌖"
                elif p_val < 23.14:
                    p_name, p_symbol = "Last Quarter", "🌗"
                else:
                    p_name, p_symbol = "Waning Crescent", "🌘"
            except Exception as e:
                pass

            astronomical_data[date_key] = {
                "sunrise": sunrise_str,
                "sunset": sunset_str,
                "moonrise": moonrise_str,
                "moonset": moonset_str,
                "moon_phase_value": round(p_val, 2),
                "moon_phase_name": p_name,
                "moon_phase_symbol": p_symbol
            }
    except Exception as e:
        print(f"Scraper: Failed to compute astronomical data: {e}")

    output_data = {
        "station_id": output_station_id,
        "station_name": station_name,
        "currents_station_id": currents_station_id,
        "date": station_today.strftime("%Y-%m-%d"),
        "units": units,
        "datum": datum,
        "timezone": station.metadata.get("timezone", "LST"),
        "water_temp": water_temp,
        "marine_forecast": marine_forecast,
        "tide_heights": tide_heights,
        "tide_extremes": tide_extremes,
        "current_predictions": current_predictions,
        "astronomical_data": astronomical_data,
        "last_updated": now.isoformat()
    }

    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)

    print(f"Scraper: Successfully saved tide data to {output_path}")

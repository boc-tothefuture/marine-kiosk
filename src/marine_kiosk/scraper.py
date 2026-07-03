import os
import json
import datetime
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

    # Request predictions for yesterday, today, and tomorrow
    # to handle timezone offsets cleanly.
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

    # Determine station's local current day by applying metadata timezone offset to UTC
    tz_offset_hours = int(station.metadata.get("timezonecorr", 0))
    utc_now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    station_local_now = utc_now + datetime.timedelta(hours=tz_offset_hours)
    station_today = station_local_now.date()

    # Filter to only entries matching the station's local date
    df_today = df[df.index.date == station_today]

    # Fallback to system date if empty
    if df_today.empty:
        system_today = now.date()
        df_today = df[df.index.date == system_today]
        station_today = system_today

    if df_today.empty:
        raise ValueError(f"No prediction data found for date {station_today}")

    # Resample to hourly and take the nearest value to the top of the hour
    df_hourly = df_today.resample("h").nearest()

    tide_heights = []
    for hour in range(24):
        hour_rows = df_hourly[df_hourly.index.hour == hour]
        if not hour_rows.empty:
            val = float(hour_rows.iloc[0]["v"])
        else:
            val = 0.0
        tide_heights.append({
            "hour": hour,
            "value": round(val, 3)
        })

    output_data = {
        "station_id": station_id,
        "station_name": station_name,
        "date": station_today.strftime("%Y-%m-%d"),
        "units": units,
        "datum": datum,
        "timezone": station.metadata.get("timezone", "LST"),
        "tide_heights": tide_heights,
        "last_updated": now.isoformat()
    }

    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)

    print(f"Scraper: Successfully saved tide data to {output_path}")

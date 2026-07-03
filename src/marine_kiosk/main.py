import os
import json
import sys
import threading
import time
from .scraper import fetch_tide_data
from .server import start_server

def load_config():
    # Find the root directory relative to this script location
    # script: src/tide_clock/main.py -> root_dir: src/..
    package_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(os.path.dirname(package_dir))
    config_path = os.path.join(root_dir, "tide_config.json")
    
    default_config = {
        "station_id": "8418150",
        "units": "english",
        "datum": "MLLW",
        "port": 8081,
        "update_interval_hours": 1
    }
    
    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                config = json.load(f)
                # Merge with defaults to ensure all keys exist
                return {**default_config, **config}
        except Exception as e:
            print(f"Error loading config.json, using defaults: {e}")
            return default_config
    else:
        # Write default config if it doesn't exist
        try:
            with open(config_path, "w") as f:
                json.dump(default_config, f, indent=2)
            print(f"Created default configuration at {config_path}")
        except Exception as e:
            print(f"Failed to create default config file: {e}")
        return default_config

def scraper_worker(station_id, units, datum, interval_hours):
    print(f"Scraper Worker: Starting scraper thread (updates every {interval_hours} hour(s)).")
    while True:
        try:
            fetch_tide_data(station_id, units, datum)
        except Exception as e:
            print(f"Scraper Worker Error: Scraper failed to fetch data: {e}")
        
        # Sleep until the next update
        time.sleep(interval_hours * 3600)

def main():
    config = load_config()
    
    station_id = config.get("station_id", "8418150")
    units = config.get("units", "english")
    datum = config.get("datum", "MLLW")
    port = config.get("port", 8081)
    interval_hours = config.get("update_interval_hours", 1)
    
    # Start the scraper loop in a background daemon thread
    scraper_thread = threading.Thread(
        target=scraper_worker,
        args=(station_id, units, datum, interval_hours),
        daemon=True
    )
    scraper_thread.start()
    
    # Run the HTTP server on the main thread
    start_server(port)

if __name__ == "__main__":
    main()

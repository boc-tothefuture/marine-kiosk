# Marine Kiosk TV UI Dashboard

A highly polished, glanceable digital marine kiosk dashboard designed for fullscreen displays (like TVs running FullPageOS or similar dashboard systems). The visual layout features a large digital clock, real-time tide height value readout, and a glowing vector SVG wave curve representing the 24-hour tide cycle.

The project is structured as a unified **`uv` application package** that serves the front-end dashboard files and runs a background thread to fetch NOAA tide predictions periodically.

---

## Directory Structure

```text
├── pyproject.toml          # UV project configuration and dependencies
├── README.md               # This documentation
├── tide_config.json        # Main configuration file
├── src/
│   └── marine_kiosk/       # Python service package
│       ├── __init__.py
│       ├── main.py         # Entrypoint orchestrating server & scraper
│       ├── scraper.py      # Scrapes NOAA predictions
│       └── server.py       # Serves static front-end assets
└── web/                    # Front-end dashboard assets
    ├── index.html          # Webpage layout
    ├── style.css           # 10ft TV UI dashboard styles
    ├── app.js              # SVG drawing & settings controller
    └── tide_data.json      # Saved predictions (generated dynamically)
```

---

## Quick Start

Ensure you have [uv](https://github.com/astral-sh/uv) installed.

### 1. Run the Unified Service

Start the server and automatic hourly tide scraper in one command:

```bash
uv run marine-kiosk
```

If you prefer to run it directly from source:
```bash
uv run python -m marine_kiosk.main
```

Once running, open your browser and navigate to: **[http://localhost:8080](http://localhost:8080)**

---

## Configuration

You can customize the NOAA station, server port, and update frequency in **`tide_config.json`**:

```json
{
  "station_id": "8418150",
  "units": "english",
  "datum": "MLLW",
  "port": 8080,
  "update_interval_hours": 1
}
```

*   `station_id`: The 7-digit NOAA tide station ID (e.g. Portland, ME is `8418150`, and The Battery, NY is `8518750`). You can find local IDs on the [NOAA CO-OPS Map](https://tidesandcurrents.noaa.gov/map/).
*   `port`: The port number the web server listens on.
*   `update_interval_hours`: How often (in hours) the background thread queries the NOAA API for fresh predictions.

---

## Screen Settings & Themes

You can interact with the dashboard directly from your web browser:
*   Open the settings panel by pressing the **`S` key** on your keyboard or clicking the gear icon in the top right.
*   **Color Theme**: Choose between *Ocean Cyan*, *Cyberpunk Pink*, *Mono White*, and *Retro Amber*.
*   **Vertical Scaling**: Toggle between *Dynamic* (expands wave to fill screen vertical space) and *Fixed* (maps heights statically between -2.0 ft and +12.0 ft).
*   **Data Source**: Toggle between *Live NOAA Data* (reads real-time file outputs) and *Simulated Offline Demo* (draws mathematical wave approximations, useful for offline testing).

---

## Running on Boot (Raspberry Pi / Linux Server)

To run the marine kiosk automatically on system startup, configure it as a **systemd service**:

1.  Create a service file `/etc/systemd/system/marine-kiosk.service`:
    ```ini
    [Unit]
    Description=Digital Marine Kiosk Daemon Service
    After=network.target

    [Service]
    Type=simple
    WorkingDirectory=/path/to/marine-kiosk
    ExecStart=/usr/local/bin/uv run marine-kiosk
    Restart=always
    RestartSec=10
    User=pi

    [Install]
    WantedBy=multi-user.target
    ```
    *(Note: Replace `/path/to/marine-kiosk` with the absolute path of your workspace, and ensure `ExecStart` points to the absolute path of the `uv` binary. Run `which uv` to find it.)*

2.  Enable and start the service:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable --now marine-kiosk.service
    ```

3.  Check status logs:
    ```bash
    sudo systemctl status marine-kiosk.service
    ```

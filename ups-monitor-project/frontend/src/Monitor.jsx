// src/Monitor.jsx
import React, { useEffect, useState } from "react";
import {
    FaTools,
    FaBatteryFull,
    FaBatteryHalf,
    FaBatteryQuarter,
    FaBatteryEmpty,
    FaMicrochip,
    FaPlug,
    FaCogs,
    FaInfoCircle,
    FaExclamationTriangle,
    FaCheckCircle,
} from "react-icons/fa";
import "./App.css";

const categories = {
    Commands: [],
    Battery: [
        "battery.charge",
        "battery.charge.low",
        "battery.charge.warning",
        "battery.mfr.date",
        "battery.runtime",
        "battery.runtime.low",
        "battery.type",
        "battery.voltage",
        "battery.voltage.nominal",
    ],
    Device: ["device.mfr", "device.model", "device.serial", "device.type"],
    Driver: [
        "driver.name",
        "driver.parameter.offdelay",
        "driver.parameter.ondelay",
        "driver.parameter.pollfreq",
        "driver.parameter.pollinterval",
        "driver.parameter.port",
        "driver.parameter.synchronous",
        "driver.version",
        "driver.version.data",
        "driver.version.internal",
        "driver.version.usb",
    ],
    Voltage: ["input.voltage", "input.voltage.nominal", "output.voltage"],
    UPS: [
        "ups.beeper.status",
        "ups.delay.shutdown",
        "ups.delay.start",
        "ups.load",
        "ups.mfr",
        "ups.model",
        "ups.productid",
        "ups.realpower.nominal",
        "ups.serial",
        "ups.status",
        "ups.test.result",
        "ups.timer.shutdown",
        "ups.timer.start",
        "ups.vendorid",
    ],
};

const icons = {
    Commands: <FaTools />,
    Battery: <FaBatteryFull />,
    Device: <FaMicrochip />,
    Driver: <FaCogs />,
    Voltage: <FaPlug />,
    UPS: <FaInfoCircle />,
};

function getBatteryIcon(charge) {
    if (charge === null || charge === undefined) return <FaBatteryFull />;
    if (charge > 75) return <FaBatteryFull color="green" />;
    if (charge > 50) return <FaBatteryHalf color="yellowgreen" />;
    if (charge > 20) return <FaBatteryQuarter color="orange" />;
    return <FaBatteryEmpty color="red" />;
}

export default function Monitor({ onLogout }) {
    const [upsData, setUpsData] = useState(null);
    const [error, setError] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState("Battery");

    const [commandResponse, setCommandResponse] = useState(null);
    const [selectedCommand, setSelectedCommand] = useState("test.battery.start.quick");
    const availableCommands = [
        "calibrate.start",
        "calibrate.stop",
        "test.battery.start.quick",
        "test.battery.stop",
    ];

    const fetchData = () => {
        fetch("http://<backend_server_ip>:5000/api/ups", {
            credentials: "include",
        })
            .then((res) => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then(setUpsData)
            .catch((err) => setError(err.message));
    };

    const sendCommand = (cmd) => {
        fetch("http://<backend_server_ip>:5000/api/ups/commands/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ command: cmd }),
        })
            .then((res) => res.json())
            .then((data) => setCommandResponse(data.result || data.error))
            .catch((err) => setCommandResponse("Error: " + err.message));
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    if (error)
        return (
            <div className="app-container error">
                <h1>Error</h1>
                <p>{error}</p>
            </div>
        );

    if (!upsData)
        return (
            <div className="app-container loading">
                <h1>Loading UPS data...</h1>
            </div>
        );

    const batteryCharge = parseInt(upsData["battery.charge"], 10);
    const batteryWarning = parseInt(upsData["battery.charge.warning"], 10);
    const batteryLow = parseInt(upsData["battery.charge.low"], 10);
    const upsStatus = upsData["ups.status"];

    const isBatteryLow = batteryCharge <= batteryLow;
    const isBatteryWarning = batteryCharge <= batteryWarning && !isBatteryLow;
    const isOnBattery = upsStatus && upsStatus !== "OL";

    const logout = () => {
        fetch("http://<backend_server_ip>:5000/api/logout", {
            method: "POST",
            credentials: "include",
        }).then(() => onLogout());
    };

    return (
        <div className="app-wrapper">
            <aside className="sidebar">
                <h2>UPS Monitor</h2>
                <nav>
                    {Object.keys(categories).map((cat) => (
                        <div
                            key={cat}
                            className={`menu-item ${cat === selectedCategory ? "active" : ""}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            <span className="icon">{icons[cat]}</span>
                            {cat}
                        </div>
                    ))}
                </nav>
                <button className="logout-btn mt-4" onClick={logout}>
                    Logout
                </button>
            </aside>

            <main className="content">
                <h1>
                    {selectedCategory} Info{" "}
                    <span className="battery-icon">{getBatteryIcon(batteryCharge)}</span>
                    {(isBatteryLow || isBatteryWarning || isOnBattery) && (
                        <span className="alarm-icon" title="UPS Alarm Active">
                            <FaExclamationTriangle color="red" />
                        </span>
                    )}
                    {!isBatteryLow && !isBatteryWarning && !isOnBattery && (
                        <span className="ok-icon" title="UPS Status OK">
                            <FaCheckCircle color="green" />
                        </span>
                    )}
                </h1>

                {(isBatteryLow || isBatteryWarning || isOnBattery) && (
                    <div className="alarm-message">
                        {isBatteryLow && <p>⚠️ Battery is LOW! Charge: {batteryCharge}%</p>}
                        {isBatteryWarning && <p>⚠️ Battery charge warning! Charge: {batteryCharge}%</p>}
                        {isOnBattery && <p>⚠️ UPS is currently ON BATTERY power!</p>}
                    </div>
                )}

                <div className="stats-list">
                    {categories[selectedCategory].map((key) => (
                        <div key={key} className="stat-row">
                            <div className="stat-key">{key}</div>
                            <div className="stat-value">{upsData[key] ?? "N/A"}</div>
                        </div>
                    ))}
                </div>

                {selectedCategory === "Commands" && (
                    <div className="commands-panel">
                        <h2>Run UPS Command</h2>
                        <div className="command-controls">
                            <select
                                value={selectedCommand}
                                onChange={(e) => setSelectedCommand(e.target.value)}
                            >
                                {availableCommands.map((cmd) => (
                                    <option key={cmd} value={cmd}>
                                        {cmd}
                                    </option>
                                ))}
                            </select>
                            <button onClick={() => sendCommand(selectedCommand)}>Run Command</button>
                        </div>

                        <div className="self-test">
                            <button onClick={() => sendCommand("test.battery.start.quick")}>
                                Run Quick Self Test
                            </button>
                        </div>

                        {commandResponse && (
                            <div className="command-response">
                                <strong>Response:</strong> {commandResponse}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
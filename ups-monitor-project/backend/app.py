from flask import Flask, jsonify, request, session
from flask_cors import CORS
from flask_mail import Mail, Message
from functools import wraps
import subprocess
import time
import os

app = Flask(__name__)
app.secret_key = "<your_session_key>"
CORS(app, supports_credentials=True, origins=["http://<backend_server_ip>:5173"])

# Configure email
app.config.update(
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME='your-gmail@gmail.com',
    MAIL_PASSWORD='<your app password with gmail>',
    MAIL_DEFAULT_SENDER=('UPS Monitor', '<your-gmail>@gmail.com')
)
mail = Mail(app)

# Throttle settings
ALERT_INTERVAL = 30 * 60  # 30 minutes in seconds
last_alert_time = 0
last_alert_state = None
UPS_NAME = "UPS1"

# Function to fetch UPS data
def get_ups_data():
    result = subprocess.run(['upsc', 'UPS1'], stdout=subprocess.PIPE, text=True)
    raw_data = result.stdout
    data = {}
    for line in raw_data.strip().split('\n'):
        if ':' in line:
            key, val = line.split(':', 1)
            data[key.strip()] = val.strip()
    return data

# Function to detect if we should send alert
def should_alert(data):
    global last_alert_time, last_alert_state

    current_time = time.time()
    critical_conditions = [
        data.get("ups.status") not in ["OL"],  # OL = Online (Normal)
        int(data.get("battery.charge", 100)) < int(data.get("battery.charge.low", 10))
    ]
    alert_signature = str(critical_conditions)

    if any(critical_conditions):
        if alert_signature != last_alert_state or (current_time - last_alert_time) > ALERT_INTERVAL:
            last_alert_time = current_time
            last_alert_state = alert_signature
            return True

    return False

# Function to send email
def send_email_alert(data):
    subject = "⚠️ UPS Alert - Attention Needed"
    body = f"""
    UPS Status: {data.get('ups.status')}
    Battery Charge: {data.get('battery.charge')}%
    Input Voltage: {data.get('input.voltage')} V
    Output Voltage: {data.get('output.voltage')} V
    Runtime Remaining: {data.get('battery.runtime')} seconds
    
    Please check the UPS immediately.
    """
    msg = Message(subject=subject, recipients=['<your-gmail>@gmail.com'], body=body)
    mail.send(msg)

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("logged_in"):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper

@app.route("/api/check-login")
def check_login():
    if session.get("logged_in"):
        return jsonify({"logged_in": True}), 200
    return jsonify({"logged_in": False}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if username == "admin" and password == "<secret_credential>":
        session["logged_in"] = True
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@login_required
@app.route("/api/ups")
def api_ups():
    data = get_ups_data()

    if should_alert(data):
        send_email_alert(data)

    return jsonify(data)

@login_required
@app.route("/api/ups/commands", methods=["GET"])
def list_commands():
    try:
        result = subprocess.run(
            ["upscmd", "-l", UPS_NAME],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode != 0:
            raise Exception(result.stderr)
        
        commands = []
        for line in result.stdout.strip().splitlines():
            if line:
                parts = line.strip().split(": ", 1)
                if len(parts) == 2:
                    commands.append({"command": parts[0], "description": parts[1]})
        return jsonify(commands)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@login_required
@app.route("/api/ups/commands/run", methods=["POST"])
def run_command():
    try:
        data = request.json
        print("Received data:", data)  # DEBUG

        command = data.get("command")
        if not command:
            return jsonify({"error": "Missing command"}), 400

        print(f"Running command: {command}")  # DEBUG

        result = subprocess.run(
            ["upscmd", "-u", "monuser", "-p", "<secret_credential>", UPS_NAME, command],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        print("subprocess returncode:", result.returncode)  # DEBUG
        print("subprocess stdout:", result.stdout)  # DEBUG
        print("subprocess stderr:", result.stderr)  # DEBUG

        if result.returncode != 0:
            raise Exception(result.stderr)

        return jsonify({"result": result.stdout.strip()})
    except Exception as e:
        print("Exception in run_command:", e)  # DEBUG
        return jsonify({"error": str(e)}), 500
    
@login_required
@app.route("/api/ups/selftest", methods=["POST"])
def selftest():
    try:
        result = subprocess.run(
            ["upscmd", "-u", "monuser", "-p", "<secret_credential>", UPS_NAME, "test.battery.start"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode != 0:
            raise Exception(result.stderr)
        return jsonify({"message": "Self-test started"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

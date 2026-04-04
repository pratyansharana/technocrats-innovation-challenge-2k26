from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import random
from typing import List

# Initialize the FastAPI application
app = FastAPI()

# Global eavesdropping state
EAVESDROPPING_ENABLED = False

# Enable CORS so your React Native app isn't blocked by network security policies
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Define the expected request body
class TransmissionRequest(BaseModel):
    bits: List[int]
    bases: List[str]
    eavesdropperActive: bool = False

# 2. The Quantum Channel Simulation
@app.post("/api/quantum_channel")
def simulate_quantum_channel(payload: TransmissionRequest):
    # Validation
    if len(payload.bits) != len(payload.bases):
        raise HTTPException(
            status_code=400, 
            detail="Bits and bases arrays must be the same length."
        )
        
    received_states = []
    
    # Use global eavesdropping state (can override with payload)
    eve_active = payload.eavesdropperActive or EAVESDROPPING_ENABLED
    
    # Process each "photon"
    for i in range(len(payload.bits)):
        current_bit = payload.bits[i]
        current_basis = payload.bases[i]
        
        # --- THE OBSERVER EFFECT (The core of BB84) ---
        if eve_active:
            # Eve intercepts the photon by guessing a basis
            eve_basis = random.choice(['+', 'X'])
            
            if eve_basis != current_basis:
                # Eve guessed wrong: The quantum state collapses.
                # The photon is re-emitted in Eve's basis with a random bit.
                current_bit = random.choice([0, 1])
                # Note: Bob will now receive this modified state
        
        # We append just the bit value to send back to the mobile app
        received_states.append(current_bit)
        
    return {
        "status": "success", 
        "received_states": received_states,
        "eavesdropping_active": eve_active
    }

# Health check route
@app.get("/")
def health_check():
    return {"message": "Basis84 Quantum Simulator is online."}


# 3. HTML Dashboard to toggle eavesdropping
@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quantum Channel Dashboard</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Courier New', monospace;
                background: linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%);
                color: #00FFCC;
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            
            .container {
                background: #0A0A0A;
                border: 2px solid #00FFCC;
                border-radius: 12px;
                padding: 40px;
                max-width: 600px;
                width: 100%;
                box-shadow: 0 0 30px rgba(0, 255, 204, 0.2);
            }
            
            h1 {
                text-align: center;
                margin-bottom: 10px;
                font-size: 28px;
                letter-spacing: 2px;
            }
            
            .subtitle {
                text-align: center;
                color: #888888;
                margin-bottom: 40px;
                font-size: 12px;
                letter-spacing: 1.5px;
            }
            
            .status-box {
                background: #050505;
                border: 1px solid #2A2A2A;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 30px;
                text-align: center;
            }
            
            .status-label {
                color: #888888;
                font-size: 12px;
                margin-bottom: 10px;
                letter-spacing: 1px;
            }
            
            .status-value {
                font-size: 20px;
                font-weight: bold;
                letter-spacing: 1.5px;
                word-break: break-all;
            }
            
            .status-value.enabled {
                color: #FF3366;
            }
            
            .status-value.disabled {
                color: #00FFCC;
            }
            
            .toggle-btn {
                width: 100%;
                padding: 16px;
                background: #1A1A1A;
                border: 2px solid #00FFCC;
                border-radius: 8px;
                color: #00FFCC;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                letter-spacing: 1px;
                transition: all 0.3s ease;
                text-transform: uppercase;
                margin-bottom: 15px;
            }
            
            .toggle-btn:hover {
                background: #00FFCC;
                color: #0A0A0A;
                box-shadow: 0 0 20px rgba(0, 255, 204, 0.4);
            }
            
            .toggle-btn:active {
                transform: scale(0.98);
            }
            
            .info-box {
                background: rgba(0, 255, 204, 0.05);
                border: 1px solid #2A2A2A;
                border-radius: 8px;
                padding: 16px;
                margin-top: 20px;
                font-size: 12px;
                line-height: 1.6;
                color: #888888;
            }
            
            .loading {
                display: none;
                text-align: center;
                margin: 20px 0;
            }
            
            .spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid #2A2A2A;
                border-top: 3px solid #00FFCC;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>⚛️ QUANTUM CHANNEL</h1>
            <p class="subtitle">BB84 PROTOCOL SIMULATOR</p>
            
            <div class="status-box">
                <div class="status-label">EAVESDROPPING DETECTION STATUS</div>
                <div class="status-value" id="statusDisplay">LOADING...</div>
            </div>
            
            <button class="toggle-btn" onclick="toggleEavesdropping()" id="toggleBtn">
                [ TOGGLE EAVESDROPPING ]
            </button>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
            </div>
            
            <div class="info-box">
                <strong>About Eavesdropping Detection:</strong><br><br>
                • <strong>ENABLED</strong> - Simulates Eve intercepting photons. Quantum uncertainty causes detectable errors.<br><br>
                • <strong>DISABLED</strong> - Clean quantum transmission between Alice and Bob. No interference detected.
            </div>
        </div>
        
        <script>
            async function fetchStatus() {
                try {
                    const response = await fetch('/api/eavesdropping');
                    const data = await response.json();
                    updateStatusDisplay(data);
                } catch (error) {
                    console.error('Error fetching status:', error);
                    document.getElementById('statusDisplay').textContent = 'ERROR';
                }
            }
            
            function updateStatusDisplay(data) {
                const statusEl = document.getElementById('statusDisplay');
                if (data.eavesdropping_enabled) {
                    statusEl.textContent = '⚠️ ENABLED';
                    statusEl.className = 'status-value enabled';
                } else {
                    statusEl.textContent = '✓ DISABLED';
                    statusEl.className = 'status-value disabled';
                }
            }
            
            async function toggleEavesdropping() {
                const loading = document.getElementById('loading');
                const btn = document.getElementById('toggleBtn');
                
                loading.style.display = 'block';
                btn.disabled = true;
                
                try {
                    const response = await fetch('/api/eavesdropping/toggle', { method: 'POST' });
                    const data = await response.json();
                    updateStatusDisplay(data);
                } catch (error) {
                    console.error('Error toggling eavesdropping:', error);
                } finally {
                    loading.style.display = 'none';
                    btn.disabled = false;
                }
            }
            
            // Fetch status on page load
            fetchStatus();
        </script>
    </body>
    </html>
    """


# 4. Get eavesdropping state (JSON API)
@app.get("/api/eavesdropping")
async def get_eavesdropping_state():
    return {
        "eavesdropping_enabled": EAVESDROPPING_ENABLED,
        "status": "ENABLED ⚠️" if EAVESDROPPING_ENABLED else "DISABLED ✓"
    }


# 5. Toggle eavesdropping (JSON API)
@app.post("/api/eavesdropping/toggle")
async def toggle_eavesdropping():
    global EAVESDROPPING_ENABLED
    EAVESDROPPING_ENABLED = not EAVESDROPPING_ENABLED
    return {
        "eavesdropping_enabled": EAVESDROPPING_ENABLED,
        "status": "ENABLED ⚠️" if EAVESDROPPING_ENABLED else "DISABLED ✓",
        "message": f"Eavesdropping detection is now {('ENABLED' if EAVESDROPPING_ENABLED else 'DISABLED')}"
    }
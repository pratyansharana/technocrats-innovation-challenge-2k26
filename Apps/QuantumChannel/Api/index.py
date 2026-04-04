from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

    for i in range(len(payload.bits)):
        current_bit = payload.bits[i]
        current_basis = payload.bases[i]
        

        if eve_active:

            eve_basis = random.choice(['+', 'X'])
            
            if eve_basis != current_basis:
                current_bit = random.choice([0, 1])

        received_states.append(current_bit)
        
    return {
        "status": "success", 
        "received_states": received_states,
        "eavesdropping_active": eve_active
    }


@app.get("/")
def health_check():
    return {"message": "Basis84 Quantum Simulator is online."}


# 3. Get current eavesdropping state
@app.get("/api/eavesdropping")
def get_eavesdropping_state():
    return {
        "eavesdropping_enabled": EAVESDROPPING_ENABLED,
        "status": "ENABLED ⚠️" if EAVESDROPPING_ENABLED else "DISABLED ✓"
    }


# 4. Toggle eavesdropping on/off
@app.post("/api/eavesdropping/toggle")
def toggle_eavesdropping():
    global EAVESDROPPING_ENABLED
    EAVESDROPPING_ENABLED = not EAVESDROPPING_ENABLED
    return {
        "eavesdropping_enabled": EAVESDROPPING_ENABLED,
        "status": "ENABLED ⚠️" if EAVESDROPPING_ENABLED else "DISABLED ✓",
        "message": f"Eavesdropping detection is now {('ENABLED' if EAVESDROPPING_ENABLED else 'DISABLED')}"
    }


# Vercel handler (required for serverless)
from mangum import Asgi

handler = Asgi(app)
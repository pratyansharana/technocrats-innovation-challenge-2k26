export type Bit = 0 | 1;
export type Basis = 'X' | '+';

export interface QuantumExchangeResponse {
  success: boolean;
  aliceBits: Bit[];
  aliceBases: Basis[];
  photonsForBob: number[];
  eavesdropping_detected?: boolean;
}

const VERCEL_API_BASE = "https://technocrats-innovation-challenge-2k.vercel.app/api";

export const QuantumKeyService = {

  generateAndTransmit: async (length: number = 256, eveActive: boolean = false): Promise<QuantumExchangeResponse> => {
    const fullUrl = `${VERCEL_API_BASE}/quantum_channel`;
    
    try {
      const aliceBits: Bit[] = Array.from({ length }, () => (Math.random() > 0.5 ? 1 : 0));
      const aliceBases: Basis[] = Array.from({ length }, () => (Math.random() > 0.5 ? 'X' : '+'));

      const payload = {
        bits: aliceBits,
        bases: aliceBases,
        eve_present: eveActive
      };


      console.log("🚀 [QuantumLink] Attempting Connection...");
      console.log("🔗 URL:", fullUrl);
      console.log("📦 Payload Sample (First 5 bits):", aliceBits.slice(0, 5));


const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bits: aliceBits,
          bases: aliceBases,
          eavesdropperActive: eveActive 
        }),
      });


      console.log("[QuantumLink] Server Status:", response.status);
      
      if (!response.ok) {
        
        const errorBody = await response.text();
        console.error("[QuantumLink] Error Body:", errorBody);
        throw new Error(`Quantum Channel failed: ${response.status}`);
      }
      

      const data = await response.json();
      console.log("[QuantumLink] Photons Received Successfully");
      console.log("[QuantumLink] Eavesdropping Active:", data.eavesdropping_active);

      return {
        success: true,
        aliceBits,
        aliceBases,
        photonsForBob: data.received_states,
        eavesdropping_detected: data.eavesdropping_active || false
      };
    } catch (error: any) {
      console.error("[QuantumLink] CRITICAL FAILURE:", error.message);
      return { success: false, aliceBits: [], aliceBases: [], photonsForBob: [] };
    }
  },

  deriveFinalKey: (bits: Bit[], myBases: Basis[], theirBases: Basis[]): Bit[] => {
    const siftedKey: Bit[] = [];
    for (let i = 0; i < myBases.length; i++) {
      if (myBases[i] === theirBases[i]) {
        siftedKey.push(bits[i]);
      }
    }
    console.log(`[Sifting] Key Derived. Original: ${bits.length} bits -> Sifted: ${siftedKey.length} bits`);
    return siftedKey;
  },

  formatToHex: (rawBits: Bit[]): string => {
    let targetBits = [...rawBits];
    if (targetBits.length > 256) targetBits = targetBits.slice(0, 256);
    while (targetBits.length < 256) targetBits.push(0); 

    let hexString = '';
    for (let i = 0; i < targetBits.length; i += 4) {
      const chunk = targetBits.slice(i, i + 4).join('');
      const hexChar = parseInt(chunk, 2).toString(16);
      hexString += hexChar;
    }
    return hexString;
  }
};
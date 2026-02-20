export interface ScaleData {
    weight: number;
    unit: 'kg' | 'lb';
    isStable: boolean;
    isZero: boolean;
    isNet: boolean;
    error?: string;
    raw: string;
}

export class ProtocolParser {
    private buffer: string = "";

    // Protocol constants
    private static readonly STX = '\x02';
    private static readonly CR = '\r'; // 0x0D

    parse(chunk: Uint8Array): ScaleData[] {
        // Strip Parity Bit (High Bit) from 7-bit ASCII
        // This is necessary because we are reading 7E1 data as 8N1 to avoid driver errors.
        // Even parity sets the high bit on some chars (like '5'), appearing as garbage in UTF-8.
        const cleanChunk = new Uint8Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
            cleanChunk[i] = chunk[i] & 0x7F;
        }

        // Decode chunk to string (assuming ASCII)
        const text = new TextDecoder().decode(cleanChunk);
        this.buffer += text;

        const results: ScaleData[] = [];

        let endIndex;
        while ((endIndex = this.buffer.indexOf(ProtocolParser.CR)) !== -1) {
            const frameStart = this.buffer.lastIndexOf(ProtocolParser.STX, endIndex);

            if (frameStart !== -1) {
                const frame = this.buffer.substring(frameStart, endIndex + 1); // Include CR
                const data = this.parseFrame(frame);
                if (data) results.push(data);

                // Remove processed buffer
                this.buffer = this.buffer.substring(endIndex + 1);
            } else {
                // CR found but no STX before it, discard garbage up to CR
                this.buffer = this.buffer.substring(endIndex + 1);
            }
        }

        return results;
    }

    private parseFrame(frame: string): ScaleData | null {
        // Frame format: <STX> [DATA] <CR>
        // Length check: Minimal valid frame is STX + ? + CR (error) = 3 chars
        if (frame.length < 3) return null;

        const content = frame.substring(1, frame.length - 1); // Strip STX and CR

        // Check for Error Frame: <STX>?<STATUS><CR>
        // Text says: "Error message ... <STX>?<status byte><CR>"
        if (content.startsWith('?')) {
            const statusChar = content.length > 1 ? content[1] : '?';

            // Map specific error codes if known
            // User reported 'P' (0x50) when removing weight -> Underload/Negative
            let errorMsg = `Error de Balanza (Código: ${statusChar})`;

            if (statusChar === 'P') {
                // Underload/Negative -> Treat as 0.00 kg
                return {
                    weight: 0,
                    unit: 'kg',
                    isStable: true,
                    isZero: true,
                    isNet: false,
                    raw: frame
                };
            } else if (statusChar === 'O') {
                errorMsg = "Sobrecarga (Overload)";
            } else if (statusChar === 'E') {
                errorMsg = "Error de Hardware / EEPROM";
            }
            // For any other status char (unknown or motion), we do NOT set an error.
            // We just return a 'neutral' zero frame or similar to prevent UI flashing.
            else {
                return {
                    weight: 0,
                    unit: 'kg',
                    isStable: false, // Assume unstable if sending ?Code
                    isZero: false,
                    isNet: false,
                    raw: frame
                };
            }

            return {
                weight: 0,
                unit: 'kg',
                isStable: true,
                isZero: false,
                isNet: false,
                error: errorMsg,
                raw: frame
            };
        }

        // Normal Weight Frame: 
        // Type 2: 0XXXX or XXXXX (5 digits)
        // Type 3: Status bytes involved? 
        // The user example: "02 31 32 2E 33 34 0D" -> 12.34
        // 0x31='1', 0x32='2', ...
        // So it's ASCII numeric string.

        // Let's try to parse the number from the content.
        // It might contain spaces or leading zeros.
        const weightStr = content.trim();
        const weight = parseFloat(weightStr);

        if (isNaN(weight)) {
            // Could be a weird status frame or garbage
            return null;
        }

        // Default status (since Type 2 simple frame doesn't always have status byte in the weight frame?)
        // Wait, Type 3 sends status bytes separately? "ECR... SCALE... Response <STX>0XXXX<CR>"
        // User text is ambiguous. We'll verify parsing simple numbers first.

        return {
            weight: weight,
            unit: 'kg', // Default, logic to detect unit later if available
            isStable: true, // Optimistic default
            isZero: weight === 0,
            isNet: false,
            raw: frame
        };
    }
}

interface SerialPort {
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
}

interface SerialOptions {
    baudRate: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: "none" | "even" | "odd";
    bufferSize?: number;
    flowControl?: "none" | "hardware";
}

interface Navigator {
    serial: {
        requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
        getPorts(): Promise<SerialPort[]>;
    };
}

interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
}

interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
}

const { SerialPort } = require('serialport');

async function main() {
    const args = process.argv.slice(2);
    const targetPort = args[0];

    console.log("=== PD-2 Scale Debug Tool (Console Mode) ===");

    if (!targetPort) {
        console.log("Searching for ports...");
        const ports = await SerialPort.list();
        if (ports.length === 0) {
            console.log("No serial ports found!");
            return;
        }

        console.log("\nAvailable Ports:");
        ports.forEach(p => console.log(` - ${p.path}\t(${p.manufacturer || 'Unknown'})`));
        console.log("\nUsage: node debug_console.js <PORT_NAME>");
        console.log("Example: node debug_console.js COM3");
        return;
    }

    console.log(`\nAttempting to open ${targetPort}...`);

    const port = new SerialPort({
        path: targetPort,
        baudRate: 9600,
        dataBits: 7,
        parity: 'even',
        stopBits: 1,
        autoOpen: false
    });

    port.open((err) => {
        if (err) {
            return console.log('Error opening port: ', err.message);
        }
        console.log('Port Open. Waiting for data...');
        console.log('Sending "W" command to initialize...');
        port.write('W\r');
    });

    port.on('data', (data) => {
        const text = data.toString('utf-8');
        const hex = data.toString('hex').match(/.{1,2}/g).join(' ').toUpperCase();

        // Clean up CR/LF for display
        const cleanText = text.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\x02/g, '<STX>');

        console.log(`[DATA] HEX: ${hex} | ASCII: ${cleanText}`);
    });

    port.on('error', (err) => {
        console.error('Error: ', err.message);
    });
}

main();

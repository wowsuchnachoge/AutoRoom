load('api_config.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_arduino_onewire.js');
load('api_timer.js');

let led = Cfg.get('app.output.led');
let temSen = Cfg.get('app.input.temp');
let rele = Cfg.get('app.output.rele');

GPIO.set_mode(led, GPIO.MODE_OUTPUT);
GPIO.set_mode(temSen, GPIO.MODE_INPUT);
GPIO.set_mode(rele, GPIO.MODE_OUTPUT);

let ow = OneWire.create(temSen);
let n = 0;
let rom = ['01234567'];

let wfCon = ffi('char *mgos_wifi_get_status_str(void)');

let ledTimer = Timer.set(500, true, function() {
    GPIO.toggle(led);
    if(wfCon() === 'got ip') {
        GPIO.write(led, 0);
        Timer.del(ledTimer);
    }
}, null);

let tempTimer = Timer.set(60000, true, function() {
    if(wfCon() !== 'got ip') { return }
    if (n === 0) {
        if ((n = searchSens()) === 0) {
            let msg = {sensor: 'No devices found', temperature: null};
            MQTT.pub('M1/temp', JSON.stringify(msg), 0);
        }
    }

    for (let i = 0; i < n; i++) {
        let t = getTemp(ow, rom[i]);
        if (isNaN(t)) {
            let msg = {sensor: i, temperature: NaN};
            MQTT.pub('M1/temp', JSON.stringify(msg), 0);
            break;
        } else {
            let msg = {sensor: i, temperature: t};
            MQTT.pub('M1/temp', JSON.stringify(msg), 0, true);
        }
    }
}, null);

MQTT.sub('M1/rele', function(conn, topic, msg) {
    if(msg === 'on') {
        GPIO.write(rele, 1);
    }
    if(msg === 'off') {
        GPIO.write(rele, 0);
    }
}, null);

let DEVICE_FAMILY = {
    DS18B20: 0x28
};

let toHexStr = function(addr) {
    let byte2hex = function(byte) {
        let hex_char = '0123456789abcdef';
        return hex_char[(byte >> 4) & 0x0F] + hex_char[byte & 0x0F];
    };
    let res = '';
    for (let i = 0; i < addr.length; i++) {
        res += byte2hex(addr.charCodeAt(i));
    }
    return res;
};

// Search for sensors
let searchSens = function() {
    let i = 0;
    // Setup the search to find the device type on the next call
    // to search() if it is present.
    ow.target_search(DEVICE_FAMILY.DS18B20);

    while (ow.search(rom[i], 0) === 1) {
        // If no devices of the desired family are currently on the bus, 
        // then another type will be found. We should check it.
        if (rom[i][0].charCodeAt(0) !== DEVICE_FAMILY.DS18B20) {
            break;
        }
        // Sensor found
        rom[++i] = '01234567';
    }
    return i;
};

// This function reads data from the DS18B20 temperature sensor
function getTemp(ow, rom) {
    let DATA = {
        TEMP_LSB: 0,
        TEMP_MSB: 1,
        REG_CONF: 4,
        SCRATCHPAD_SIZE: 9
    };

    let REG_CONF = {
        RESOLUTION_9BIT: 0x00,
        RESOLUTION_10BIT: 0x20,
        RESOLUTION_11BIT: 0x40,
        RESOLUTION_MASK: 0x60
    };

    let CMD = {
        CONVERT_T: 0x44,
        READ_SCRATCHPAD: 0xBE
    };

    if (ow.reset() === 0) return NaN;
    ow.select(rom);
    ow.write(CMD.CONVERT_T);

    ow.delay(750);

    ow.reset();
    ow.select(rom);
    ow.write(CMD.READ_SCRATCHPAD);

    let data = [];
    for (let i = 0; i < DATA.SCRATCHPAD_SIZE; i++) {
        data[i] = ow.read();
    }

    let raw = (data[DATA.TEMP_MSB] << 8) | data[DATA.TEMP_LSB];
    let cfg = (data[DATA.REG_CONF] & REG_CONF.RESOLUTION_MASK);

    if (cfg === REG_CONF.RESOLUTION_9BIT) {
        raw = raw & ~7;
    } else if (cfg === REG_CONF.RESOLUTION_10BIT) {
        raw = raw & ~3;
    } else if (cfg === REG_CONF.RESOLUTION_11BIT) {
        raw = raw & ~1;
    }
    // Default resolution is 12 bit

    return raw / 16.0;
};
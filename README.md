# AutoRoom

Mongoose OS IoT room automation app

## AutoRoom App Overview

This is an app written for the ESP8266 MCU. The purpose of this app is to automate some characteristics of a house room. With this app, you can control the room light switch and sense the room temperature. All the data is sent via MQTT to a RaspberryPi server connected to the local network, and the events' data is stored in a local database. The ESP8266 sends data, but also recieves data from the RaspberryPi server. On the RaspberryPi side, a PIR sensor is attached to the board and it is used to send the signal to automatically turn on the lights when movement is detected in the room.

## Materials used
- ESP8266
- RaspberryPi 4
- HC-SR501 PIR sensor
- DS18B20 temperature sensor
- HW-307 relay module



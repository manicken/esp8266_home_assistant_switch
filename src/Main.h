#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include <ESP8266WebServer.h>
#include <WebSocketsServer.h>


#ifndef MAIN_H_
#define MAIN_H_

#define DEBUG_UART Serial1

namespace Main {
    Adafruit_SSD1306 display(128, 64, &Wire, -1); // -1 = no reset pin
    ESP8266WebServer webServer(80);
    WebSocketsServer webSocketServer = WebSocketsServer(81); // websocket used for remote debugging through webpage

    void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t lenght);

    void setup() {
        webServer.begin();
        webSocketServer.begin();                          // start the websocket server
        webSocketServer.onEvent(webSocketEvent);          // if there's an incomming websocket message, go to function 'webSocketEvent'
    }

    void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t lenght) { // When a WebSocket message is received
        switch (type) {
            case WStype_DISCONNECTED:             // if the websocket is disconnected
                DEBUG_UART.printf("[%u] Disconnected!\n", num);
            break;
            case WStype_CONNECTED: {              // if a new websocket connection is established
                IPAddress ip = webSocketServer.remoteIP(num);
                DEBUG_UART.printf("[%u] Connected from %d.%d.%d.%d url: %s\n", num, ip[0], ip[1], ip[2], ip[3], payload);
            }
            break;
            case WStype_TEXT:                     // if new text data is received
                DEBUG_UART.printf("[%u] get Text: %s\n", num, payload);
            break;
        }
    }

    void webSocketSendText(String &payload) {
        int count = webSocketServer.connectedClients();
        if (count > 0) {
            for (int i=0;i<count;i++)
                webSocketServer.sendTXT(i, payload);
        }
    }
}

#endif
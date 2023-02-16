
#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include <ESP8266WiFi.h>
#include <WiFiManager.h>

#ifndef MAIN_HELPERS_H
#define MAIN_HELPERS_H

// QUICKFIX...See https://github.com/esp8266/Arduino/issues/263
#define min(a,b) ((a)<(b)?(a):(b))
#define max(a,b) ((a)>(b)?(a):(b))


#define DEBUG_UART Serial1

namespace MainHelpers {

    Adafruit_SSD1306 *display;
    void printESP_info(void);
    void setup_wifi();

    void setup(Adafruit_SSD1306 &_display)
    {
        display = &_display;
    }

    void setup_wifi()
    {
        WiFiManager wifiManager;
        DEBUG_UART.println(F("trying to connect to saved wifi"));
        display->setCursor(0, 0);
        display->print("WiFi connecting...");
        display->display();
        if (wifiManager.autoConnect() == true) { // using ESP.getChipId() internally
            display->setCursor(0, 8);
            display->print("OK");
            display->setCursor(0, 0);
            display->print("                  ");
            display->setCursor(0, 0);
            display->print(WiFi.localIP());
            display->display();
        } else {
            display->setCursor(0, 8);
            display->print("FAIL");
            display->display();
        }
        //delay(2000);
    }

    // called from setup() function
    void printESP_info(void) { 
        uint32_t realSize = ESP.getFlashChipRealSize();
        uint32_t ideSize = ESP.getFlashChipSize();
        FlashMode_t ideMode = ESP.getFlashChipMode();
    
        DEBUG_UART.print(F("Flash real id:   ")); DEBUG_UART.printf("%08X\r\n", ESP.getFlashChipId());
        DEBUG_UART.print(F("Flash real size: ")); DEBUG_UART.printf("%u 0\r\n\r\n", realSize);
    
        DEBUG_UART.print(F("Flash ide  size: ")); DEBUG_UART.printf("%u\r\n", ideSize);
        DEBUG_UART.print(F("Flash ide speed: ")); DEBUG_UART.printf("%u\r\n", ESP.getFlashChipSpeed());
        DEBUG_UART.print(F("Flash ide mode:  ")); DEBUG_UART.printf("%s\r\n", (ideMode == FM_QIO ? "QIO" : ideMode == FM_QOUT ? "QOUT" : ideMode == FM_DIO ? "DIO" : ideMode == FM_DOUT ? "DOUT" : "UNKNOWN"));
    
        if(ideSize != realSize)
        {
            DEBUG_UART.println(F("Flash Chip configuration wrong!\r\n"));
        }
        else
        {
            DEBUG_UART.println(F("Flash Chip configuration ok.\r\n"));
        }
        DEBUG_UART.printf(" ESP8266 Chip id = %08X\n", ESP.getChipId());
    }
}

#endif
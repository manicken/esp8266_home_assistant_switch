
#include <Arduino.h>
//#include "ArduinoTuya.h"
//#include "TuyaLocal.hpp"
#include <Adafruit_SSD1306.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include "FileHelpers.h"
#include "Main.h"

#ifndef LOCAL_TUYA_H
#define LOCAL_TUYA_H

#define LOCAL_TUYA_JSONDOC_SIZE 2048
#define LOCAL_TUYA_JSON_FILENAME "/tuya/cfg.json"
#define LOCAL_TUYA_JSON_LOAD_URL "/tuya/cfg/load"
#define LT_JSON_NAME_DEVICE_ID   "id"
#define LT_JSON_NAME_DEVICE_KEY  "key"
#define LT_JSON_NAME_DEVICE_HOST "host"

namespace LocalTuya
{
    enum SWITCH_MODE {
        off = (0),
        on = (1),
        toggle = (2)
    };
    //tuyaLocal tl;
    //TuyaDevice plug;
    DynamicJsonDocument jsonDoc(LOCAL_TUYA_JSONDOC_SIZE);
    String jsonStr = "";

    void setup();
    void exec(int index, int mode);
    void loadJson();
    void set_default_jsonDoc_properties_if_needed();

    void setup()
    {
        Main::webServer.on(LOCAL_TUYA_JSON_LOAD_URL, []() {
            loadJson();
            Main::webServer.send(200, "text/plain", "OK");
        });
        loadJson();
    }

    void exec(int index, int mode)
    {
        Main::display.setCursor(0,26);
        Main::display.print("                ");
        Main::display.setCursor(0,26);
        
        if (jsonDoc[index] == nullptr) {
            Main::display.print(index);
            Main::display.print(" device index not found");
            return;
        }
        if (jsonDoc[index][LT_JSON_NAME_DEVICE_ID] == nullptr) {
            Main::display.print(" device id not found");
            return;
        }
        if (jsonDoc[index][LT_JSON_NAME_DEVICE_KEY] == nullptr) {
            Main::display.print(" device key not found");
            return;
        }
        if (jsonDoc[index][LT_JSON_NAME_DEVICE_HOST] == nullptr) {
            Main::display.print(" device host not found");
            return;
        }
        /*tuya_error_t err;
        plug.begin(jsonDoc[index][LT_JSON_NAME_DEVICE_ID], 
                   jsonDoc[index][LT_JSON_NAME_DEVICE_KEY],
                   jsonDoc[index][LT_JSON_NAME_DEVICE_HOST]);
        
        if (mode == (int)SWITCH_MODE::off)
            err = plug.set(false);
        else if (mode == (int)SWITCH_MODE::on)
            err = plug.set(true);
        else if (mode == (int)SWITCH_MODE::toggle)
            err = plug.toggle();

        if (err == tuya_error_t::TUYA_OK)
            Main::display.print("OK");
        else {
            Main::display.print(err);
            Main::display.print(plug.response);
        }
        */
       /*
        bool send = false;
        String dps = "";

        if (mode == (int)SWITCH_MODE::off) {
            send = true;
            dps = "\"dps\":{\"1\":false}";
        }
        else if (mode == (int)SWITCH_MODE::on) {
            send = true;
            dps = "\"dps\":{\"1\":true}";
        }
        else if (mode == (int)SWITCH_MODE::toggle) {
            // TODO
            // need to first read status from device 
            tl.begin(jsonDoc[index][LT_JSON_NAME_DEVICE_HOST], 
                jsonDoc[index][LT_JSON_NAME_DEVICE_ID], 
                jsonDoc[index][LT_JSON_NAME_DEVICE_KEY]);

            if (tl.connect() == false) { DEBUG_UART.print("fuck u china"); return; }
            
            tl.getDps(dps);
            DEBUG_UART.println("");
            DEBUG_UART.println(dps);
            if (dps.startsWith("{\"dps\":{\"1\":true")) { dps = "\"dps\":{\"1\":false}"; send = true;}
            else if (dps.startsWith("{\"dps\":{\"1\":false")) { dps = "\"dps\":{\"1\":true}"; send = true;}
            tl.disconnect();
            //DEBUG_UART.print(dps);
        }

        if (send == true) {
            tl.begin(jsonDoc[index][LT_JSON_NAME_DEVICE_HOST], 
                jsonDoc[index][LT_JSON_NAME_DEVICE_ID], 
                jsonDoc[index][LT_JSON_NAME_DEVICE_KEY]);

            if (tl.connect() == false) return;
            String result = "";
            tl.setDps(dps, result);
            tl.disconnect();
            DEBUG_UART.print(result);
        }*/
    }

    void loadJson()
    {
        if (!FileHelpers::load_from_file(LOCAL_TUYA_JSON_FILENAME, jsonStr))
        {
            set_default_jsonDoc_properties_if_needed();
        }
        else
        {
            deserializeJson(jsonDoc, jsonStr);
            set_default_jsonDoc_properties_if_needed();
        }
    }

    void set_default_jsonDoc_properties_if_needed()
    {
        
    }
}

#endif
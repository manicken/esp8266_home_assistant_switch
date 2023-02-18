#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include <ESP8266WebServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "FileHelpers.h"

#ifndef BUTTONS_H
#define BUTTONS_H

#define DEBUG_UART Serial1

#define BUTTONS_JSONDOC_SIZE 2048
#define BUTTONS_JSON_FILENAME           "/btn/settings.json"
#define BUTTONS_JSON_LOAD_URL           "/btn/settings/load"
#define BUTTONS_GET_MODE_URL            "/modes"
#define BUTTONS_GET_TARGETS_URL         "/targets"
#define BTN_JSON_NAME_TARGET            "target"
#define BTN_JSON_NAME_TARGET_INDEX      "ti"
#define BTN_JSON_NAME_TARGET_MODE       "tm"
#define BTN_JSON_NAME_BUTTON_EXEC_STATE "bes"

namespace Buttons {

    char modes[] PROGMEM = R"=====(
        ["Off","On","Toggle"]
    )=====";

    char targets[] PROGMEM = R"=====(
        ["None","Local Tuya","Home Assistant"]
    )=====";

    enum BTN_TARGET {
        None = 0,
        Local_Tuya = 1,
        Home_Assistant = 2
    };
    enum BTN_EXEC_STATE {
        Released = 0,
        Pressed = 1,
        Both = 2
    };
    enum SWITCH_MODE {
        off = (0),
        on = (1),
        toggle = (2)
    };

    uint8_t buttonStates_raw = 0;
    bool buttons_pressed[64];

    ESP8266WebServer *server;
    Adafruit_SSD1306 *display; // mostly used for debug
    DynamicJsonDocument jsonDoc(BUTTONS_JSONDOC_SIZE);
    uint buttonCount = 0;
    int nrOfChips = 0;
    
    String jsonStr = "";

    bool checkKeyState(int nr);
    void keyTask();
    void loadJson();
    void set_default_jsonDoc_properties_if_needed();

    // using callbacks as then homeassistant and localtuya don't need to be referenced here 
    void (*homeAssistant_exec_cb)(int,int);
    void (*localTuya_exec_cb)(int,int); 

    void setup(Adafruit_SSD1306 &_display, ESP8266WebServer &_server, void(*homeAssistant_exec_cb)(int,int), void(*localTuya_exec_cb)(int,int))
    {
        display = &_display;
        server = &_server;
        Buttons::homeAssistant_exec_cb = homeAssistant_exec_cb;
        Buttons::localTuya_exec_cb = localTuya_exec_cb;

        server->on(BUTTONS_GET_MODE_URL, []() {
            server->send(200, "text/plain", modes);
        });
        server->on(BUTTONS_GET_TARGETS_URL, []() {
            server->send(200, "text/plain", targets);
        });
        server->on(BUTTONS_JSON_LOAD_URL, []() {
            loadJson();
            server->send(200, "text/plain", "OK");
        });
        loadJson();

        // right now we use static size (@ max button count)
        for (int i=0;i<64;i++) buttons_pressed[i] = false;

        if (buttonCount <= 8) nrOfChips = 1;
        else if (buttonCount <= 16) nrOfChips = 2;
        else if (buttonCount <= 24) nrOfChips = 3;
        else if (buttonCount <= 32) nrOfChips = 4;
        else if (buttonCount <= 40) nrOfChips = 5;
        else if (buttonCount <= 48) nrOfChips = 6;
        else if (buttonCount <= 56) nrOfChips = 7;
        else nrOfChips = 8; // max number of pcf8574 that can be on one i2c bus

        // init all pcf8574:s 
        for (int i=0;i<nrOfChips;i++) {
            Wire.beginTransmission(0x38+i);
            Wire.write(0xFF); // all inputs
            Wire.endTransmission();
        }
    }

    void exec(int index) {
        if (jsonDoc[index][BTN_JSON_NAME_TARGET] == (int)BTN_TARGET::Home_Assistant) {
            if (homeAssistant_exec_cb != nullptr)
                homeAssistant_exec_cb(jsonDoc[index][BTN_JSON_NAME_TARGET_INDEX], jsonDoc[index][BTN_JSON_NAME_TARGET_MODE]);
        }
        else if (jsonDoc[index][BTN_JSON_NAME_TARGET] == (int)BTN_TARGET::Local_Tuya) {
            if (localTuya_exec_cb != nullptr)
                localTuya_exec_cb(jsonDoc[index][BTN_JSON_NAME_TARGET_INDEX], jsonDoc[index][BTN_JSON_NAME_TARGET_MODE]);
        }
        else if (jsonDoc[index][BTN_JSON_NAME_TARGET] == (int)BTN_TARGET::None) {
            // doing nothing
        }
    }

    void keyTask()
    {
        uint8_t raw = 0;
        int btnIndex = 0;
        for (int ci=0;ci<nrOfChips;ci++) { // chip index
            Wire.requestFrom(0x38+ci, 1);
            raw = Wire.read();

            for (int bi=0;bi<8;bi++) { // bit index
                btnIndex = ci*8+bi;
                display->setCursor(bi*6*2, 32+8*ci);
                if ((raw & 0x01) == 0x01 && buttons_pressed[btnIndex] == false) {
                    buttons_pressed[btnIndex] = true;
                    if (jsonDoc[btnIndex][BTN_JSON_NAME_BUTTON_EXEC_STATE] == (int)BTN_EXEC_STATE::Pressed ||
                        jsonDoc[btnIndex][BTN_JSON_NAME_BUTTON_EXEC_STATE] == (int)BTN_EXEC_STATE::Both) {
                        exec(btnIndex);
                    }
                    display->print("1 ");
                } else if ((raw & 0x01) == 0x00 && buttons_pressed[btnIndex] == true) {
                    buttons_pressed[btnIndex] = false;
                    if (jsonDoc[btnIndex][BTN_JSON_NAME_BUTTON_EXEC_STATE] == (int)BTN_EXEC_STATE::Released ||
                        jsonDoc[btnIndex][BTN_JSON_NAME_BUTTON_EXEC_STATE] == (int)BTN_EXEC_STATE::Both) {
                        exec(btnIndex);
                    }
                    display->print("0 ");
                } else if (buttons_pressed[btnIndex] == true) {
                    display->print("1x");
                } else if (buttons_pressed[btnIndex] == false) {
                    display->print("0x");
                }
                
                raw = raw >> 1;
            }
        }
        display->display();
    }

    void loadJson()
    {
        if (!FileHelpers::load_from_file(BUTTONS_JSON_FILENAME, jsonStr))
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
        buttonCount = jsonDoc.size();
        OLedHelpers::printAt(0,24,buttonCount);

        bool changed = false;
        for (int i=0;i<(int)buttonCount;i++) {
            if (jsonDoc[i] == nullptr) // should never happen
            {
                jsonDoc[i][BTN_JSON_NAME_TARGET] = (int)BTN_TARGET::Home_Assistant;
                jsonDoc[i][BTN_JSON_NAME_TARGET_INDEX] = i;
                changed = true;
            }
            else
            {
                if (jsonDoc[i].containsKey(BTN_JSON_NAME_TARGET) == false) {
                    jsonDoc[i][BTN_JSON_NAME_TARGET] = (int)BTN_TARGET::Home_Assistant;
                    changed = true;
                }
                if (jsonDoc[i].containsKey(BTN_JSON_NAME_TARGET_INDEX) == false) {
                    jsonDoc[i][BTN_JSON_NAME_TARGET_INDEX] = i;
                    changed = true;
                }
                if (jsonDoc[i].containsKey(BTN_JSON_NAME_TARGET_MODE) == false) {
                    jsonDoc[i][BTN_JSON_NAME_TARGET_MODE] = 0;
                    changed = true;
                }
                if (jsonDoc[i].containsKey(BTN_JSON_NAME_BUTTON_EXEC_STATE) == false) { 
                    jsonDoc[i][BTN_JSON_NAME_BUTTON_EXEC_STATE] = (int)BTN_EXEC_STATE::Pressed;
                    changed = true;
                }
            }
        }

        if (changed == true)
        {
            jsonStr = "";
            serializeJsonPretty(jsonDoc, jsonStr);
            FileHelpers::write_to_file(BUTTONS_JSON_FILENAME, jsonStr);
        }
    }
}
#endif
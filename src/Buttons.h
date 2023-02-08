#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include <Wire.h>

#ifndef BUTTONS_H
#define BUTTONS_H

namespace Buttons {

    bool checkKeyState(int nr);
    void keyTask();

    uint8_t buttonStates_raw = 0;
    bool buttons_pressed[8] = {false, false, false, false, false, false, false, false};

    Adafruit_SSD1306 *display;

    void (*buttonPressed_cb)(int);
    void (*buttonReleased_cb)(int); // not used at the moment

    void setup(Adafruit_SSD1306 &_display, void(*buttonPressed_cb)(int))
    {
        display = &_display;
        Buttons::buttonPressed_cb = buttonPressed_cb;

        Wire.beginTransmission(0x38);
        Wire.write(0xFF); // all led off & all inputs
        Wire.endTransmission(0x38);
    }

    bool checkKeyState(int nr)
    {
        if (nr == 0 && (buttonStates_raw & 0x01) == 0x01) return true;
        else if (nr == 1 && (buttonStates_raw & 0x02) == 0x02) return true;
        else if (nr == 2 && (buttonStates_raw & 0x04) == 0x04) return true;
        else if (nr == 3 && (buttonStates_raw & 0x08) == 0x08) return true;
        else if (nr == 4 && (buttonStates_raw & 0x10) == 0x10) return true;
        else if (nr == 5 && (buttonStates_raw & 0x20) == 0x20) return true;
        else if (nr == 6 && (buttonStates_raw & 0x40) == 0x40) return true;
        else if (nr == 7 && (buttonStates_raw & 0x80) == 0x80) return true;
        return false;
    }

    void keyTask()
    {
        Wire.requestFrom(0x38, 1);
        buttonStates_raw = Wire.read();

        display->setCursor(0, 47);

        for (int i = 0; i < 8; i++) {
            if (buttons_pressed[i] == false && checkKeyState(i) == true)
            {
                buttons_pressed[i] = true;
                if (buttonPressed_cb != nullptr)
                    buttonPressed_cb(i);
                display->print("1 ");
            }
            else if (buttons_pressed[i] == true && checkKeyState(i) == false)
            {
                buttons_pressed[i] = false;
                if (buttonReleased_cb != nullptr)
                    buttonReleased_cb(i);
                display->print("0 ");
            }
            // following are only for debug
            else if (buttons_pressed[i] == true)
            {
                display->print("1x");
            }
            else if (buttons_pressed[i] == false)
            {
                display->print("0x");
            }
        }
        display->display();
    }
}
#endif
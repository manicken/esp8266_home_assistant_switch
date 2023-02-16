#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>
#include <Arduino.h>

#ifndef OLED_HELPERS_H
#define OLED_HELPERS_H

#define DEBUG_UART Serial1

namespace OLedHelpers
{
    void initDisplay(uint8_t addr);
    void write12digitDec(Adafruit_SSD1306 display, uint32_t value, uint8_t maxDigits, uint8_t dotPos);
    void displayPrintHttpState(int httpCode);
    

    Adafruit_SSD1306 *display;

    void setup(Adafruit_SSD1306 &_display)
    {
        display = &_display;

        if (display->begin(SSD1306_SWITCHCAPVCC, 0x3C))
            initDisplay(0x3C);
        else{
            DEBUG_UART.println(F("oled init fail @ addr 0x3C"));
            if (display->begin(SSD1306_SWITCHCAPVCC, 0x3D)) {
                DEBUG_UART.println(F("oled addr is 0x3D"));
                initDisplay(0x3D);
            }
            else
                DEBUG_UART.println(F("oled init also fail @ addr 0x3D"));
        }
    }
    void initDisplay(uint8_t addr)
    {
        delay(2000);
        display->begin(SSD1306_SWITCHCAPVCC, addr);
        delay(2000);
        display->clearDisplay();
        display->display();
        display->setTextSize(1);
        display->setTextColor(WHITE, BLACK);
    }

    void write12digitDec(uint32_t value, uint8_t maxDigits, uint8_t dotPos = 0) {
        uint32_t rest = value;
        uint32_t curr = rest / 100000000000;
        //display.clearDisplay();
        if (maxDigits >= 12)
            display->print(curr);
        rest = rest % 100000000000;
        curr = rest / 10000000000;
        if (maxDigits >= 11)
            display->print(curr);
        if (dotPos == 10) display->print('.');
        rest = rest % 10000000000;
        curr = rest / 1000000000;
        if (maxDigits >= 10)
            display->print(curr);
        if (dotPos == 9) display->print('.');
        rest = rest % 1000000000;
        curr = rest / 100000000;
        if (maxDigits >= 9)
            display->print(curr);
        if (dotPos == 8) display->print('.');
        rest = rest % 100000000;
        curr = rest / 10000000;
        if (maxDigits >= 8)
            display->print(curr);
        if (dotPos == 7) display->print('.');
        rest = rest % 10000000;
        curr = rest / 1000000;
        if (maxDigits >= 7)
            display->print(curr);
        if (dotPos == 6) display->print('.');
        rest = rest % 1000000;
        curr = rest / 100000;
        if (maxDigits >= 6)
            display->print(curr);
        if (dotPos == 5) display->print('.');
        rest = rest % 100000;
        curr = rest / 10000;
        if (maxDigits >= 5)
            display->print(curr);
        if (dotPos == 4) display->print('.');
        rest = rest % 10000;
        curr = rest / 1000;
        if (maxDigits >= 4)
            display->print(curr);
        if (dotPos == 3) display->print('.');
        rest = rest % 1000;
        curr = rest / 100;
        if (maxDigits >= 3)
            display->print(curr);
        if (dotPos == 2) display->print('.');
        rest = rest % 100;
        curr = rest / 10;
        if (maxDigits >= 2)
            display->print(curr);
        if (dotPos == 1) display->print('.');
        rest = rest % 10;
        if (maxDigits >= 1)
            display->print(rest, 10);

    }

    void displayPrintHttpState(int httpCode)
    {
        if (httpCode > 0) { // ok
            display->setCursor(0,56);
            display->print(httpCode);
            display->print(" OK ");
        }
        else // fail
        {
            display->setCursor(0,56);
            display->print(httpCode);
            display->print(" FAIL ");
        }
        display->display();
    }

    void printAt(uint x, uint y, const Printable & cp) { display->setCursor(x, y); display->print(cp); }
    void printAt(uint x, uint y, char c) { display->setCursor(x, y); display->print(c); }
    void printAt(uint x, uint y, const char cca[]) { display->setCursor(x, y); display->print(cca); }
    void printAt(uint x, uint y, const String &cs) { display->setCursor(x, y); display->print(cs); }
    void printAt(uint x, uint y, const __FlashStringHelper* ifsh) { display->setCursor(x, y); display->print(ifsh); }
    void printAt(uint x, uint y, double dv, int vt = 2) { display->setCursor(x, y); display->print(dv, vt); }
    void printAt(uint x, uint y, unsigned long long ullv, int vt = 10) { display->setCursor(x, y); display->print(ullv, vt); }
    void printAt(uint x, uint y, long long llv, int vt = 10) { display->setCursor(x, y); display->print(llv, vt); }
    void printAt(uint x, uint y, unsigned long ulv, int vt = 10) { display->setCursor(x, y); display->print(ulv, vt); }
    void printAt(uint x, uint y, long lv, int vt = 10) { display->setCursor(x, y); display->print(lv, vt); }
    void printAt(uint x, uint y, unsigned int uiv, int vt = 10) { display->setCursor(x, y); display->print(uiv, vt); }
    void printAt(uint x, uint y, int iv, int vt = 10) { display->setCursor(x, y); display->print(iv, vt); }
    void printAt(uint x, uint y, unsigned char uc, int vt = 10) { display->setCursor(x, y); display->print(uc, vt); }

}
#endif
// 
//    FILE: TCP2UART.h
// VERSION: 
// PURPOSE: 
// LICENSE: 



#ifndef TCP2UART_h
#define TCP2UART_h

#if defined(ARDUINO) && (ARDUINO >= 100)
#include <Arduino.h>
#else
#include <WProgram.h>
#endif

#include <functional>

#define TCP2UART_CONFIG_TCPPORT 8201
#define TCP2UART_BRIDGE_TCPPORT 8200

#define TCP2UART_SERIAL 	Serial
//#define TCP2UART_BAUD 	115200
//#define TCP2UART_UART_CFG SERIAL_7E1 // 7bit data, even parity, one stopbit
//#define TCP2UART_UART_CFG SERIAL_8N1 // 8bit data, no parity, one stopbit

class TCP2UART
{
    public:
        typedef std::function<void(void)> THandlerFunction;
        bool bridgeInConfigMode = false;
        bool bridgeClientConnected = false;
        bool uartMessageReceived = false;
        size_t rxBuffSize = 255;

        SerialConfig serialConfig = SERIAL_8N1;
        unsigned long serialBaud = 19200;
        uint8_t * serialRxBuff;
        size_t serialRxDataLength = 0; // current data length

        uint8_t * tcpRxBuff;
        size_t tcpRxDataLength = 0; // current data length

        void begin();
        void BridgeMainTask();
        /*
        void serialTransmit(const char *message, THandlerFunction fn);
        void serialTransmit(String message, THandlerFunction fn);
      	boolean serialReceive_Task();
        */
      	
    private:
        THandlerFunction _serialReceiveHandler_callback;
        void bridgeConfigRx_parse_SerialSetting(void);
};
#endif
//
// END OF FILE
//

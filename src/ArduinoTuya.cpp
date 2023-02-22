// ArduinoTuya
// Copyright Alex Cortelyou 2018
// MIT License

#include "ArduinoTuya.h"

void TuyaDevice::initGetRequest(JsonDocument &jsonRequest) {
  jsonRequest["gwId"] = _id;  //device id
  jsonRequest["devId"] = _id; //device id
}

void TuyaDevice::initSetRequest(JsonDocument &jsonRequest) {
  jsonRequest["t"] = 0;       //epoch time (required but value doesn't appear to be used)
  jsonRequest["devId"] = _id; //device id
  jsonRequest.createNestedObject("dps");
  jsonRequest["uid"] = _id;    //user id (required but value doesn't appear to be used)
}

String TuyaDevice::createPayload(JsonDocument &jsonRequest, bool encrypt) {

  // Serialize json request
  String jsonString;
  serializeJson(jsonRequest, jsonString);

  DEBUG_PRINT("REQUEST  ");
  DEBUG_PRINTLN(jsonString);
    
  if (!encrypt) return jsonString;

  // Determine lengths and padding
  const int jsonLength = jsonString.length();
  const int cipherPadding = TUYA_BLOCK_LENGTH - jsonLength % TUYA_BLOCK_LENGTH;
  const int cipherLength = jsonLength + cipherPadding;

  // Allocate encrypted data buffer
  byte cipherData[cipherLength];

  // Use PKCS7 padding mode
  memcpy(cipherData, jsonString.c_str(), jsonLength);
  memset(&cipherData[jsonLength], cipherPadding, cipherPadding);

  // AES ECB encrypt each block
  for (int i = 0; i < cipherLength; i += TUYA_BLOCK_LENGTH) {
    AES_ECB_encrypt(&_aes, &cipherData[i]);
  }


  // Base64 encode encrypted data
  String base64Data = base64::encode(cipherData, cipherLength, false);
  
  // Calculate MD5 hash signature
  _md5.begin();
  _md5.add("data=");
  _md5.add(base64Data);
  _md5.add("||lpv=");
  _md5.add(_version);
  _md5.add("||");
  _md5.add(_key);
  _md5.calculate();
  String md5 = _md5.toString().substring(8, 24);

  // Create signed payload
  String payload = String(_version + md5 + base64Data);
  
  DEBUG_PRINT("PAYLOAD  ");
  DEBUG_PRINTLN(payload);

  return payload;
}

int TuyaDevice::createPayload2(String &jsonString, byte* cipherData) {

  // Serialize json request
  //String jsonString;
  //serializeJson(jsonRequest, jsonString);

  DEBUG_PRINT("REQUEST2  ");
  DEBUG_PRINTLN(jsonString);
    
  //if (!encrypt) return jsonString;

  // Determine lengths and padding
  const int jsonLength = jsonString.length();
  const int cipherPadding = TUYA_BLOCK_LENGTH - jsonLength % TUYA_BLOCK_LENGTH;
  int cipherLength = jsonLength + cipherPadding;

  // Allocate encrypted data buffer
  //byte cipherData[cipherLength];
  //cipherData = (byte *) malloc(cipherLength);

  // Use PKCS7 padding mode
  memcpy(cipherData, jsonString.c_str(), jsonLength);
  memset(&cipherData[jsonLength], cipherPadding, cipherPadding);

  // AES ECB encrypt each block
  for (int i = 0; i < cipherLength; i += TUYA_BLOCK_LENGTH) {
    AES_ECB_encrypt(&_aes, &cipherData[i]);
  }
  return cipherLength;
}

String TuyaDevice::sendCommand(String &payload, byte command) {
  byte bytes[payload.length()];

  payload.getBytes(bytes, payload.length());
  return sendCommand(bytes, payload.length(), command);
}

String TuyaDevice::sendCommand(byte *payload, int payloadLength, byte command) {
  DEBUG_PRINTLN("sendCommand byte* payload ");
  // Attempt to send command at least once
  int tries = 0;
  while (tries++ <= TUYA_RETRY_COUNT) {

    // Determine lengths and offsets
    const int bodyOffset = TUYA_PREFIX_LENGTH;
    const int bodyLength = payloadLength + TUYA_SUFFIX_LENGTH;    
    const int suffixOffset = TUYA_PREFIX_LENGTH + payloadLength;    
    const int requestLength = TUYA_PREFIX_LENGTH + payloadLength + TUYA_SUFFIX_LENGTH;

    // Assemble request buffer
    byte request[requestLength];
    memcpy(request, prefix, 11);
    request[11] = command;
    request[12] = (byte) ((bodyLength>>24) & 0xFF);
    request[13] = (byte) ((bodyLength>>16) & 0xFF);
    request[14] = (byte) ((bodyLength>> 8) & 0xFF);
    request[15] = (byte) ((bodyLength>> 0) & 0xFF);
    DEBUG_PRINTLN("sendCommand before memcpy1");
    memcpy(&request[bodyOffset], payload, payloadLength);
    DEBUG_PRINTLN("sendCommand before memcpy2");
    memcpy(&request[suffixOffset], suffix, TUYA_SUFFIX_LENGTH);
    DEBUG_PRINTLN("sendCommand after all memcpy");

    // Connect to device
    _client.setTimeout(TUYA_TIMEOUT);
    if (!_client.connect(_host, _port)) {
      DEBUG_PRINTLN("TUYA SOCKET ERROR");
      _error = TUYA_ERROR_SOCKET;
      delay(TUYA_RETRY_DELAY);
      continue;
    }

    // Wait for socket to be ready for write
    while (_client.connected() && _client.availableForWrite() < requestLength) delay(10);
    //char hexstr[requestLength*2 + 1];
    //ToString(request, &hexstr[0], requestLength);
    //TUYA_DEBUG_SERIAL.println("request data:");
    //TUYA_DEBUG_SERIAL.println(hexstr);
    // Write request to device
    _client.write(request, requestLength);

    // Wait for socket to be ready for read
    while (_client.connected() && _client.available() < 11) delay(10);


    // Read response prefix   (bytes 1 to 11)
    byte buffer[11];
    _client.read(buffer, 11);
    //TUYA_DEBUG_SERIAL.println("\nresponse prefix(11bytes):");
    //TUYA_DEBUG_SERIAL.write(buffer, 11);

    // Check prefix match
    if (memcmp(prefix, buffer, 11) != 0) {
      DEBUG_PRINTLN("TUYA PREFIX MISMATCH");
      _error = TUYA_ERROR_PREFIX;
      _client.stop();
      delay(TUYA_RETRY_DELAY);
      continue;
    }

    // Read response command  (byte 12) (ignored)
    _client.read(buffer, 1);
    //TUYA_DEBUG_SERIAL.println("\nresponse command(1byte):");
    //TUYA_DEBUG_SERIAL.write(buffer, 1);

    // Read response length   (bytes 13 to 16)
    _client.read(buffer, 4);
    //TUYA_DEBUG_SERIAL.println("\nresponse length(4bytes):");
    //TUYA_DEBUG_SERIAL.write(buffer, 4);

    // Assemble big-endian response length
    size_t length = (buffer[0]<<24)|(buffer[1]<<16)|(buffer[2]<<8)|(buffer[3])-12;

    // Read response unknown  (bytes 17 to 20) (ignored)
    _client.read(buffer, 4);
    //TUYA_DEBUG_SERIAL.println("\nresponse unknown(4bytes):");
    //TUYA_DEBUG_SERIAL.write(buffer, 4);

    // Allocate response buffer
    byte response[length+1];
    memset(response, 0, length+1);

    // Read response          (bytes 21 to N-8)
    _client.read(response, length);
    //TUYA_DEBUG_SERIAL.print("\nresponse (");
    //TUYA_DEBUG_SERIAL.print(length);
    //TUYA_DEBUG_SERIAL.println("bytes):");
    //TUYA_DEBUG_SERIAL.write(buffer, length);
    
    // Read response suffix   (bytes N-7 to N)
    _client.read(buffer, 8);

    // Check last four bytes of suffix match
    if (memcmp(&suffix[4], &buffer[4], 4) != 0) {
      DEBUG_PRINTLN("TUYA SUFFIX MISMATCH");
      _error = TUYA_ERROR_SUFFIX;
      _client.stop();
      delay(TUYA_RETRY_DELAY);
      continue;
    }

    // Check length match
    if (_client.available() > 0) {
      DEBUG_PRINTLN("TUYA LENGTH MISMATCH");
      _error = TUYA_ERROR_LENGTH;
      _client.stop();
      delay(TUYA_RETRY_DELAY);
      continue;
    }

    // Close connection
    _client.stop();

    
    AES_ECB_decrypt(&_aes, response);
    //AES_ECB_decrypt(&_aes, &response[17]);
    
  //AES_ECB_decrypt(&_aes, response);
    if (length > 0) {
      DEBUG_PRINT("\nRESPONSE ");
      DEBUG_PRINTLN((const char*)response);
    }
    
    _error = TUYA_OK;
    return String((const char*)response);
  }

  return String("");
}

tuya_error_t TuyaDevice::get() {

    // Allocate json objects
    StaticJsonDocument<512> jsonRequest;
    StaticJsonDocument<512> jsonResponse;
    
    // Build request
    initGetRequest(jsonRequest);
    
    String payload = createPayload(jsonRequest, false);

    String response = sendCommand(payload, 10);
    TUYA_DEBUG_SERIAL.println("get response:");
    TUYA_DEBUG_SERIAL.println(response);
    TUYA_DEBUG_SERIAL.println("get response end");
    // Check for errors
    if (_error != TUYA_OK) return _error;

    // Deserialize json response
    auto error = deserializeJson(jsonResponse, response);
    if (error) return _error = TUYA_ERROR_PARSE;

    // Check response
    JsonVariant state = jsonResponse["dps"]["1"];
    if (state.isNull()) return _error = TUYA_ERROR_PARSE;

    _state = state.as<bool>() ? TUYA_ON : TUYA_OFF;
    return _error = TUYA_OK;
}

void ToString(byte *array, char *hexstr, int size) {
  //byte array[size];
  //char hexstr[size];
  int i;
  for (i=0; i<size; i++) {
      sprintf(hexstr+i*2, "%02x", array[i]);
  }
  hexstr[i*2] = 0;
  //return String(hexstr);
}

tuya_error_t TuyaDevice::set(bool state) {

    // Allocate json object
    StaticJsonDocument<512> jsonRequest;
    
    // Build request
    initSetRequest(jsonRequest);
    jsonRequest["dps"]["1"] = state;    //state
    //jsonRequest["dps"]["t"] = 0;        //delay  
    
    if (_version == "3.1") {
      String payload = createPayload(jsonRequest);
      response = sendCommand(payload, 7);
    }
    else {
      String jsonString;
      serializeJson(jsonRequest, jsonString);
      byte payload[jsonString.length()+ (TUYA_BLOCK_LENGTH - jsonString.length() % TUYA_BLOCK_LENGTH)];
      //byte* payload = (byte*) malloc();
      int payloadLenght = createPayload2(jsonString, &payload[0]);
      //TUYA_DEBUG_SERIAL.print("payloadLenght:"); TUYA_DEBUG_SERIAL.println(payloadLenght);
      //char hexstr[payloadLenght*2+1];
      //ToString(payload, hexstr, payloadLenght);
      //TUYA_DEBUG_SERIAL.println(hexstr);
      //TUYA_DEBUG_SERIAL.write(payload, payloadLenght);
      //TUYA_DEBUG_SERIAL.print("\nafter");
      response = sendCommand(payload,payloadLenght , 7);
    }
    
  
    

    // Check for errors
    if (_error != TUYA_OK) return _error;
    if (response.length() != 0) return _error = TUYA_ERROR_LENGTH;

    _state = state ? TUYA_ON : TUYA_OFF;

    return _error = TUYA_OK;
}

tuya_error_t TuyaDevice::toggle() {
  return set(!_state);
}

tuya_error_t TuyaBulb::setColorRGB(byte r, byte g, byte b) {
  //https://gist.github.com/postspectacular/2a4a8db092011c6743a7
  float R = asFloat(r);
  float G = asFloat(g);
  float B = asFloat(b);
  float s = step(B, G);
  float px = mix(B, G, s);
  float py = mix(G, B, s);
  float pz = mix(-1.0, 0.0, s);
  float pw = mix(0.6666666, -0.3333333, s);
  s = step(px, R);
  float qx = mix(px, R, s);
  float qz = mix(pw, pz, s);
  float qw = mix(R, px, s);
  float d = qx - min(qw, py);
  float H = abs(qz + (qw - py) / (6.0 * d + 1e-10));
  float S = d / (qx + 1e-10);
  float V = qx;

  return setColorHSV(asByte(H), asByte(S), asByte(V));
}

tuya_error_t TuyaBulb::setColorHSV(byte h, byte s, byte v) {

  // Format color as hex string
  char hexColor[7];
  sprintf(hexColor, "%02x%02x%02x", h, s, v);

  // Allocate json object
  StaticJsonDocument<512> jsonRequest;
  
  // Build request
  initSetRequest(jsonRequest);
  jsonRequest["dps"]["5"] = hexColor;
  jsonRequest["dps"]["2"] = "colour";

  String payload = createPayload(jsonRequest);
 
  String response = sendCommand(payload, 7);

  return _error;
}

tuya_error_t TuyaBulb::setWhite(byte brightness, byte temp) {

  if (brightness < 25 || brightness > 255) {
    DEBUG_PRINTLN("BRIGHTNESS MUST BE BETWEEN 25 AND 255");
    return _error = TUYA_ERROR_ARGS;
  }

  // Allocate json object
  StaticJsonDocument<512> jsonRequest;
  
  // Build request
  initSetRequest(jsonRequest);
  jsonRequest["dps"]["2"] = "white";
  jsonRequest["dps"]["3"] = brightness;
  jsonRequest["dps"]["4"] = temp;

  String payload = createPayload(jsonRequest);
 
  String response = sendCommand(payload, 7);

  return _error;  
}

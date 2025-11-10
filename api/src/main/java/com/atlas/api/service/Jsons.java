// api/src/main/java/com/atlas/api/service/Jsons.java
package com.atlas.api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

public final class Jsons {
    private static final ObjectMapper M = new ObjectMapper();
    public static List<String> stringArray(String json) { try { return json==null? List.of(): M.readValue(json, new TypeReference<>(){});} catch(Exception e){ return List.of(); } }
    public static Map<String,String> map(String json) { try { return json==null? Map.of(): M.readValue(json, new TypeReference<>(){});} catch(Exception e){ return Map.of(); } }
    public static String toJsonArray(List<String> arr){ try { return M.writeValueAsString(arr==null? List.of():arr);} catch(Exception e){ return "[]"; } }
    public static String toJsonObject(Map<String,?> map){ try { return M.writeValueAsString(map==null? Map.of():map);} catch(Exception e){ return "{}"; } }
}

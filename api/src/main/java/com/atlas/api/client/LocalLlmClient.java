package com.atlas.api.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * HTTP client for communicating with a local LLM server (e.g., Ollama).
 */
@Component
public class LocalLlmClient {
    
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String model;
    
    public LocalLlmClient(
            @Value("${llm.base-url:http://localhost:11434}") String baseUrl,
            @Value("${llm.model:llama3}") String model) {
        this.baseUrl = baseUrl;
        this.model = model;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
        
        // Configure timeout
        // Note: RestTemplate timeout configuration would need HttpComponentsClientHttpRequestFactory
        // For simplicity, we'll rely on default timeouts or configure via properties
    }
    
    /**
     * Generate a JSON rule from natural language prompt.
     * 
     * @param systemPrompt The system prompt with instructions and examples
     * @param userPrompt The user's natural language request
     * @return The LLM's response as a String (expected to be JSON)
     * @throws LocalLlmException if the LLM call fails
     */
    public String generateJsonRule(String systemPrompt, String userPrompt) throws LocalLlmException {
        try {
            // Construct the full prompt
            String fullPrompt = systemPrompt + "\n\nUser request:\n" + userPrompt + "\n\nOutput JSON only:";
            
            // Prepare request body for Ollama-like API
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", model);
            requestBody.put("prompt", fullPrompt);
            requestBody.put("stream", false);
            requestBody.put("format", "json"); // Request JSON format if supported
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            // Call the LLM API
            String apiUrl = baseUrl + "/api/generate";
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl,
                    HttpMethod.POST,
                    request,
                    String.class
            );
            
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new LocalLlmException("LLM API returned status: " + response.getStatusCode());
            }
            
            // Parse response - Ollama returns JSON with "response" field
            String responseBody = response.getBody();
            if (responseBody == null || responseBody.trim().isEmpty()) {
                throw new LocalLlmException("Empty response from LLM");
            }
            
            // Try to extract JSON from Ollama response format
            try {
                JsonNode jsonNode = objectMapper.readTree(responseBody);
                if (jsonNode.has("response")) {
                    String llmResponse = jsonNode.get("response").asText();
                    // Clean up the response - remove markdown code blocks if present
                    llmResponse = llmResponse.trim();
                    if (llmResponse.startsWith("```json")) {
                        llmResponse = llmResponse.substring(7);
                    }
                    if (llmResponse.startsWith("```")) {
                        llmResponse = llmResponse.substring(3);
                    }
                    if (llmResponse.endsWith("```")) {
                        llmResponse = llmResponse.substring(0, llmResponse.length() - 3);
                    }
                    return llmResponse.trim();
                }
                // If response is already JSON, return it
                return responseBody;
            } catch (Exception e) {
                // If parsing fails, assume the response body is the JSON directly
                String cleaned = responseBody.trim();
                if (cleaned.startsWith("```json")) {
                    cleaned = cleaned.substring(7);
                }
                if (cleaned.startsWith("```")) {
                    cleaned = cleaned.substring(3);
                }
                if (cleaned.endsWith("```")) {
                    cleaned = cleaned.substring(0, cleaned.length() - 3);
                }
                return cleaned.trim();
            }
            
        } catch (RestClientException e) {
            throw new LocalLlmException("Failed to call LLM API: " + e.getMessage(), e);
        }
    }
    
    public static class LocalLlmException extends Exception {
        public LocalLlmException(String message) {
            super(message);
        }
        
        public LocalLlmException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}


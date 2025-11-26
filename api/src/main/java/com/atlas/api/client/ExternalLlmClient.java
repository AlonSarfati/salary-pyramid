package com.atlas.api.client;

import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.completion.chat.ChatMessageRole;
import com.theokanning.openai.service.OpenAiService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * HTTP client for communicating with OpenAI (or other external LLM services).
 */
@Component
public class ExternalLlmClient {
    
    private final String apiKey;
    private final String model;
    private OpenAiService openAiService;
    
    public ExternalLlmClient(
            @Value("${openai.apiKey:}") String apiKey,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.model = model;
        
        // Don't initialize OpenAiService if API key is missing - allow app to start
        // Will fail gracefully when generateJsonRule is called
        if (!this.apiKey.isEmpty()) {
            this.openAiService = new OpenAiService(this.apiKey, Duration.ofSeconds(60));
        }
    }
    
    /**
     * Generate a JSON rule from natural language prompt.
     * 
     * @param systemPrompt The system prompt with instructions and examples
     * @param userPrompt The user's natural language request
     * @return The LLM's response as a String (expected to be JSON)
     * @throws ExternalLlmException if the LLM call fails
     */
    public String generateJsonRule(String systemPrompt, String userPrompt) throws ExternalLlmException {
        // Check if API key is configured
        if (apiKey == null || apiKey.isEmpty()) {
            throw new ExternalLlmException(
                "OpenAI API key is not configured. Set the OPENAI_API_KEY environment variable " +
                "or configure openai.apiKey in application.properties"
            );
        }
        
        // Lazy initialization if not already initialized
        if (openAiService == null) {
            openAiService = new OpenAiService(apiKey, Duration.ofSeconds(60));
        }
        
        try {
            // Build chat messages
            List<ChatMessage> messages = new ArrayList<>();
            messages.add(new ChatMessage(ChatMessageRole.SYSTEM.value(), systemPrompt));
            messages.add(new ChatMessage(ChatMessageRole.USER.value(), userPrompt));
            
            // Create completion request
            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model(model)
                    .messages(messages)
                    .temperature(0.3) // Lower temperature for more consistent JSON output
                    .maxTokens(1000)
                    .build();
            
            // Call OpenAI API
            String response = openAiService.createChatCompletion(request)
                    .getChoices()
                    .get(0)
                    .getMessage()
                    .getContent();
            
            if (response == null || response.trim().isEmpty()) {
                throw new ExternalLlmException("Empty response from LLM");
            }
            
            // Clean up the response - remove markdown code blocks if present
            String cleaned = response.trim();
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
            
        } catch (Exception e) {
            throw new ExternalLlmException("Failed to call OpenAI API: " + e.getMessage(), e);
        }
    }
    
    public static class ExternalLlmException extends Exception {
        public ExternalLlmException(String message) {
            super(message);
        }
        
        public ExternalLlmException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}


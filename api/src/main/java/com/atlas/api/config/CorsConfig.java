package com.atlas.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource; // ✅ servlet (MVC) package
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

import java.util.List;

@Configuration
public class CorsConfig { // (typo fix optional)

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        // Allow all origins for now (behind CloudFront, origin will vary)
        // In production, you can restrict this to your CloudFront domain
        cfg.setAllowedOriginPatterns(List.of("*")); // Use patterns for wildcard support
        cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(false); // Must be false when using wildcard origins
        // if you need to read custom headers in the FE response, you can expose them:
        // cfg.setExposedHeaders(List.of("Location"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // Use our CORS configuration
                .cors(c -> {})
                // Stateless API + SPA, no CSRF tokens
                .csrf(AbstractHttpConfigurer::disable)
                // Our authorization rules
                .authorizeHttpRequests(auth -> auth
                        // Health endpoint for ALB / monitoring (under context-path /api)
                        .requestMatchers("/api/actuator/health/**", "/api/actuator/info/**").permitAll()
                        // Frontend entry & static assets (served by S3/CloudFront, but allow if backend serves them)
                        .requestMatchers(
                                "/",
                                "/index.html",
                                "/favicon.ico",
                                "/assets/**",
                                "/static/**",
                                "/*.js",
                                "/*.css",
                                "/*.png",
                                "/*.svg"
                        ).permitAll()
                        // All backend API endpoints under /api servlet path
                        // Spring Security sees the full path including /api before servlet path is stripped
                        .requestMatchers("/api/**").permitAll()
                        // Fallback: permit all for now (stateless API, no auth layer)
                        .anyRequest().permitAll()
                )
                // Do NOT enable HTTP Basic or form login (no login pages)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable);

        return http.build();
    }
}

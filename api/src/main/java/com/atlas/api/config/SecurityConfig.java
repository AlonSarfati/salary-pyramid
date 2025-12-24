package com.atlas.api.config;

import com.atlas.api.auth.AccessGateFilter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final AccessGateFilter accessGateFilter;
    private final ApplicationContext applicationContext;

    public SecurityConfig(AccessGateFilter accessGateFilter, ApplicationContext applicationContext) {
        this.accessGateFilter = accessGateFilter;
        this.applicationContext = applicationContext;
    }

    @Bean
    @ConditionalOnProperty(name = "spring.security.oauth2.resourceserver.jwt.issuer-uri")
    public Converter<Jwt, AbstractAuthenticationToken> jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        // We don't extract authorities from JWT - roles come from our DB
        converter.setJwtGrantedAuthoritiesConverter(jwt -> List.<GrantedAuthority>of());
        return converter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // Use CORS configuration
                .cors(c -> {})
                // Stateless API + SPA, no CSRF tokens
                .csrf(AbstractHttpConfigurer::disable);

        // Conditionally configure OAuth2 Resource Server only if JwtDecoder bean exists
        // Spring Boot auto-creates JwtDecoder when spring.security.oauth2.resourceserver.jwt.issuer-uri is set
        boolean oidcEnabled = applicationContext.getBeanNamesForType(JwtDecoder.class).length > 0;
        
        if (oidcEnabled) {
            // Spring Boot has auto-configured JwtDecoder, so we can configure oauth2ResourceServer
            http.oauth2ResourceServer(oauth2 -> oauth2
                    .jwt(jwt -> {
                        // Try to use custom converter if available
                        try {
                            Converter<Jwt, AbstractAuthenticationToken> converter = 
                                applicationContext.getBean("jwtAuthenticationConverter", Converter.class);
                            jwt.jwtAuthenticationConverter(converter);
                        } catch (Exception e) {
                            // Custom converter not available, use default
                        }
                    })
            );
            
            // Add access gate filter AFTER oauth2ResourceServer configuration
            // This ensures it runs after BearerTokenAuthenticationFilter
            // We add it before ExceptionTranslationFilter to ensure it runs after authentication
            http.addFilterBefore(accessGateFilter, org.springframework.security.web.access.ExceptionTranslationFilter.class);
        }

        http
                // Our authorization rules
                .authorizeHttpRequests(auth -> {
                    if (oidcEnabled) {
                        // With OIDC enabled: require authentication for protected endpoints
                        auth
                                // Health endpoint for ALB / monitoring (under context-path /api)
                                .requestMatchers("/actuator/health/**", "/actuator/info/**").permitAll()
                                // Auth endpoints - require JWT but are not blocked by allowlist
                                .requestMatchers("/auth/me", "/auth/debug-claims").authenticated()
                                // Admin endpoints - permit all (admin key check happens in controller)
                                .requestMatchers("/admin/**").permitAll()
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
                                // All other /api/** endpoints require authentication
                                // AccessGateFilter will enforce allowlist
                                .requestMatchers("/**").authenticated()
                                // Fallback: permit all for non-API paths
                                .anyRequest().permitAll();
                    } else {
                        // Without OIDC: permit all (backward compatible)
                        auth.anyRequest().permitAll();
                    }
                })
                // Do NOT enable HTTP Basic or form login (no login pages)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable);

        return http.build();
    }
}


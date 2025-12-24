package com.atlas.api.config;

import com.atlas.api.auth.AccessGateFilter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.core.env.Environment;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
public class CorsConfig {

    private final AccessGateFilter accessGateFilter;
    private final Environment environment;
    private final ApplicationContext applicationContext;

    public CorsConfig(AccessGateFilter accessGateFilter, Environment environment, ApplicationContext applicationContext) {
        this.accessGateFilter = accessGateFilter;
        this.environment = environment;
        this.applicationContext = applicationContext;
    }

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
                // Use our CORS configuration
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
        }

        http
                // Our authorization rules
                .authorizeHttpRequests(auth -> {
                    if (oidcEnabled) {
                        // With OIDC enabled: require authentication for protected endpoints
                        auth
                                // Health endpoint for ALB / monitoring (under context-path /api)
                                .requestMatchers("/api/actuator/health/**", "/api/actuator/info/**").permitAll()
                                // Auth endpoints - require JWT but are not blocked by allowlist
                                .requestMatchers("/api/auth/me", "/api/auth/debug-claims").authenticated()
                                // Admin endpoints - permit all (admin key check happens in controller)
                                .requestMatchers("/api/admin/**").permitAll()
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
                                .requestMatchers("/api/**").authenticated()
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

        // Add access gate filter only if OIDC is enabled
        // The filter must run AFTER JWT authentication (OAuth2 Resource Server filter)
        // The OAuth2 Resource Server filter chain is added when we call oauth2ResourceServer()
        // We need to add our filter AFTER those filters but BEFORE the authorization filter
        // Since we can't directly reference BearerTokenAuthenticationFilter, we'll add it
        // after UsernamePasswordAuthenticationFilter (which won't be used) but the OAuth2
        // filters will have already run by the time our filter executes
        if (oidcEnabled) {
            // Important: The oauth2ResourceServer() call above adds filters to the chain
            // Our filter needs to run after those filters. Since filters are added in order,
            // and oauth2ResourceServer() is called before this, the OAuth2 filters will run first.
            // However, to be safe, we'll add our filter using a position that ensures it runs
            // after authentication filters but before authorization.
            http.addFilterAfter(accessGateFilter, UsernamePasswordAuthenticationFilter.class);
        }

        return http.build();
    }
}

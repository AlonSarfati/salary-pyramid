# ---- Build stage ----
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY . .
RUN mvn -q -B -DskipTests -pl api -am package

# ---- Runtime stage ----
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
ENV JAVA_OPTS="-Xms256m -Xmx512m"
EXPOSE 8080
COPY --from=build /workspace/api/target/*.jar /app/app.jar
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]

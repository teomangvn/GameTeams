# --- Derleme ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Once yalnizca pom: bagimliliklar ayri katmanda onbelleklenir, kod
# degistiginde yeniden indirilmez.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q clean package -DskipTests

# Katmanli jar: bagimliliklar ve uygulama sinifi ayri katmanlara acilir,
# boylece kod degisiminde yalnizca kucuk katman yeniden yuklenir.
RUN java -Djarmode=layertools -jar target/backend-*.jar extract --destination extracted

# --- Calisma ---
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Root olmayan kullanici: konteyner ele gecirilse bile yetki sinirli kalir.
RUN addgroup -S app && adduser -S -G app app

COPY --from=build --chown=app:app /build/extracted/dependencies/ ./
COPY --from=build --chown=app:app /build/extracted/spring-boot-loader/ ./
COPY --from=build --chown=app:app /build/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=app:app /build/extracted/application/ ./

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8080/actuator/health | grep -q '"status":"UP"' || exit 1

# Konteyner bellek sinirlarina uy; sabit -Xmx yerine yuzde kullanilir.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC"

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]

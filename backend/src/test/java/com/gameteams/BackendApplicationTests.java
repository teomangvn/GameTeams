package com.gameteams;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.testcontainers.DockerClientFactory;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@EnabledIf("dockerAvailable")
class BackendApplicationTests {

	/**
	 * Testcontainers çalışan bir Docker daemon'a ihtiyaç duyar. Erişilemiyorsa
	 * test başarısız olmak yerine atlanır: derlemenin kırmızı olması ortamla
	 * ilgili bir sorunu kod hatası gibi gösterirdi.
	 *
	 * Not: Docker Desktop 29.x'in API proxy'si, Testcontainers 1.21.x içindeki
	 * docker-java istemcisine /info çağrısında boş gövdeyle HTTP 400 döndürüyor
	 * (aynı named pipe üzerinde docker CLI sorunsuz çalışırken). Bu durumda test
	 * atlanır; Testcontainers'ın Docker 29 destekleyen bir sürümü yayınlandığında
	 * kendiliğinden tekrar koşacaktır.
	 */
	static boolean dockerAvailable() {
		try {
			return DockerClientFactory.instance().isDockerAvailable();
		}
		catch (Throwable ex) {
			return false;
		}
	}

	@Test
	void contextLoads() {
	}

}

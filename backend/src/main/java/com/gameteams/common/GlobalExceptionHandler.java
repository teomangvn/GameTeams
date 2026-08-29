package com.gameteams.common;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** İstemciye dönen tek tip hata gövdesi. */
    public record ApiError(
            Instant timestamp,
            int status,
            String code,
            String message,
            Map<String, String> fieldErrors) {

        static ApiError of(HttpStatus status, String code, String message) {
            return new ApiError(Instant.now(), status.value(), code, message, null);
        }
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> handleApiException(ApiException ex) {
        return ResponseEntity.status(ex.status())
                .body(ApiError.of(ex.status(), ex.code(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (var error : ex.getBindingResult().getFieldErrors()) {
            // Aynı alan için ilk hatayı koru; listeyi gürültüye boğmayalım.
            fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return ResponseEntity.badRequest().body(new ApiError(
                Instant.now(),
                HttpStatus.BAD_REQUEST.value(),
                "VALIDATION_FAILED",
                "Girdiğin bilgilerde hata var.",
                fieldErrors));
    }

    /**
     * Beklenmeyen hatalar: ayrıntı loglanır, istemciye genel mesaj döner —
     * yığın izi veya SQL hatası sızdırmamak için.
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        log.error("Beklenmeyen hata", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                        "Beklenmeyen bir hata oluştu."));
    }
}

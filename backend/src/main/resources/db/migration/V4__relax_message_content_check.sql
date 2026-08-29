-- V3'teki kisit icerigin en az 1 karakter olmasini sart kosuyordu; bu, yumusak
-- silmenin icerigi bosaltmasiyla catisiyor (silinen mesajin metni gizlenmeli).
--
-- Sorumluluk ayrimi: veritabani depolama sinirini korur, bos mesaj kurali
-- MessageService icinde uygulanir (send ve edit yollarinda).
ALTER TABLE messages DROP CONSTRAINT messages_content_length;
ALTER TABLE messages ADD CONSTRAINT messages_content_length
    CHECK (char_length(content) <= 4000);

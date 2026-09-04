-- Mesaj ekleri.
--
-- Dosya diske yazılır, satır yalnızca üstveri tutar. Mesaj silinince eki de
-- gider (CASCADE); diskteki dosya AttachmentStorage tarafından temizlenir.

CREATE TABLE message_attachments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id   UUID         NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    -- Kullanıcıya gösterilen ad. Diskteki ad bu değil: istemci adı güvenilmez.
    file_name    VARCHAR(255) NOT NULL,
    -- Diskteki rastgele ad; tahmin edilemez olması erişim kontrolünün parçası.
    stored_name  VARCHAR(255) NOT NULL UNIQUE,
    content_type VARCHAR(100) NOT NULL,
    size_bytes   BIGINT       NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_attachments_message ON message_attachments (message_id);

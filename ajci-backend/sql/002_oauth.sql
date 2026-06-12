-- Google OAuth users have no password, so password_hash must be optional.
alter table users alter column password_hash drop not null;

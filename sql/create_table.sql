CREATE TABLE IF NOT EXISTS banned_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  link VARCHAR(500) NOT NULL
  -- Ajoute d'autres colonnes ici si nécessaire
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

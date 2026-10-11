
import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      sucesso: false,
      mensagem: "Método não permitido."
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        sucesso: false,
        mensagem: "A conexão com o banco não está configurada."
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    const complementos = await sql`
      SELECT id, nome, preco
      FROM complementos
      WHERE ativo = TRUE
      ORDER BY id ASC
    `;

    return res.status(200).json({
      sucesso: true,
      complementos
    });
  } catch (erro) {
    console.error("Erro ao carregar complementos:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível carregar os complementos."
    });
  }
}

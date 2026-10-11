
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
                mensagem: "Conexão com o banco não configurada."
            });
        }

        const sql = neon(process.env.DATABASE_URL);

        const produtos = await sql`
            SELECT id, nome, categoria, preco, ativo
            FROM produtos
            WHERE ativo = TRUE
            ORDER BY categoria, nome
        `;

        return res.status(200).json({
            sucesso: true,
            produtos
        });

    } catch (erro) {
        console.error("Erro ao carregar cardápio:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Não foi possível carregar o cardápio."
        });
    }
}

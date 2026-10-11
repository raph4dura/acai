
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const produtos = await sql`
        SELECT id, nome, categoria, preco, ativo, criado_em
        FROM produtos
        ORDER BY id DESC
      `;

      return res.status(200).json({
        sucesso: true,
        produtos
      });
    }

    if (req.method === "POST") {
      const { nome, categoria, preco } = req.body || {};

      if (
        !nome?.trim() ||
        !categoria?.trim() ||
        preco === undefined ||
        preco === null ||
        preco === "" ||
        !Number.isFinite(Number(preco)) ||
        Number(preco) < 0
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe nome, categoria e um preço válido."
        });
      }

      const resultado = await sql`
        INSERT INTO produtos (nome, categoria, preco, ativo)
        VALUES (
          ${nome.trim()},
          ${categoria.trim()},
          ${Number(preco)},
          TRUE
        )
        RETURNING id, nome, categoria, preco, ativo, criado_em
      `;

      return res.status(201).json({
        sucesso: true,
        mensagem: "Produto cadastrado com sucesso!",
        produto: resultado[0]
      });
    }

    if (req.method === "PUT") {
      const { id, nome, categoria, preco, ativo } = req.body || {};

      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID do produto inválido."
        });
      }

      if (
        nome !== undefined &&
        (typeof nome !== "string" || !nome.trim())
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "O nome não pode ficar vazio."
        });
      }

      if (
        categoria !== undefined &&
        (typeof categoria !== "string" || !categoria.trim())
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "A categoria não pode ficar vazia."
        });
      }

      if (
        preco !== undefined &&
        (
          preco === "" ||
          !Number.isFinite(Number(preco)) ||
          Number(preco) < 0
        )
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Preço inválido."
        });
      }

      if (ativo !== undefined && typeof ativo !== "boolean") {
        return res.status(400).json({
          sucesso: false,
          mensagem: "O campo ativo deve ser verdadeiro ou falso."
        });
      }

      const resultado = await sql`
        UPDATE produtos
        SET
          nome = COALESCE(${nome === undefined ? null : nome.trim()}, nome),
          categoria = COALESCE(${categoria === undefined ? null : categoria.trim()}, categoria),
          preco = COALESCE(${preco === undefined ? null : Number(preco)}, preco),
          ativo = COALESCE(${ativo === undefined ? null : ativo}, ativo)
        WHERE id = ${Number(id)}
        RETURNING id, nome, categoria, preco, ativo, criado_em
      `;

      if (resultado.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Produto não encontrado."
        });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: "Produto atualizado com sucesso!",
        produto: resultado[0]
      });
    }

    if (req.method === "DELETE") {
      const id = Number(req.query?.id);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID do produto inválido."
        });
      }

      const resultado = await sql`
        DELETE FROM produtos
        WHERE id = ${id}
        RETURNING id
      `;

      if (resultado.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Produto não encontrado."
        });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: "Produto excluído com sucesso!"
      });
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");

    return res.status(405).json({
      sucesso: false,
      mensagem: "Método não permitido."
    });
  } catch (erro) {
    console.error("Erro ao gerenciar produtos:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro interno ao gerenciar produtos."
    });
  }
}

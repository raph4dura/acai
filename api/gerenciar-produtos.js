
import { neon } from "@neondatabase/serverless";
import { exigirDono } from "./dono-auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Aceita somente os métodos utilizados pela API.
  const metodosPermitidos = ["GET", "POST", "PUT", "DELETE"];

  res.setHeader("Allow", metodosPermitidos.join(", "));

  if (!metodosPermitidos.includes(req.method)) {
    return res.status(405).json({
      sucesso: false,
      mensagem: "Método não permitido."
    });
  }

  try {
    // Somente o dono autenticado pode gerenciar o cardápio.
    if (!exigirDono(req, res)) {
      return;
    }

    if (!process.env.DATABASE_URL) {
      console.error("A variável DATABASE_URL não está configurada.");

      return res.status(500).json({
        sucesso: false,
        mensagem: "A conexão com o banco não está configurada."
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    // ==========================================
    // LISTAR PRODUTOS
    // ==========================================

    if (req.method === "GET") {
      const produtos = await sql`
        SELECT
          id,
          nome,
          categoria,
          preco,
          ativo,
          criado_em
        FROM produtos
        ORDER BY id DESC
      `;

      return res.status(200).json({
        sucesso: true,
        produtos
      });
    }

    // ==========================================
    // CADASTRAR PRODUTO
    // ==========================================

    if (req.method === "POST") {
      const { nome, categoria, preco } = req.body || {};

      const nomeValido =
        typeof nome === "string" &&
        nome.trim().length > 0 &&
        nome.trim().length <= 150;

      const categoriaValida =
        typeof categoria === "string" &&
        categoria.trim().length > 0 &&
        categoria.trim().length <= 100;

      const precoValido =
        preco !== undefined &&
        preco !== null &&
        preco !== "" &&
        Number.isFinite(Number(preco)) &&
        Number(preco) >= 0 &&
        Number(preco) <= 999999;

      if (!nomeValido || !categoriaValida || !precoValido) {
        return res.status(400).json({
          sucesso: false,
          mensagem:
            "Informe um nome de até 150 caracteres, uma categoria de até 100 caracteres e um preço entre R$ 0,00 e R$ 999.999,00."
        });
      }

      const resultado = await sql`
        INSERT INTO produtos (
          nome,
          categoria,
          preco,
          ativo
        )
        VALUES (
          ${nome.trim()},
          ${categoria.trim()},
          ${Number(preco)},
          TRUE
        )
        RETURNING
          id,
          nome,
          categoria,
          preco,
          ativo,
          criado_em
      `;

      return res.status(201).json({
        sucesso: true,
        mensagem: "Produto cadastrado com sucesso!",
        produto: resultado[0]
      });
    }

    // ==========================================
    // EDITAR OU ATIVAR/DESATIVAR PRODUTO
    // ==========================================

    if (req.method === "PUT") {
      const { id, nome, categoria, preco, ativo } = req.body || {};

      const idValido =
        id !== undefined &&
        id !== null &&
        String(id).trim() !== "" &&
        Number.isSafeInteger(Number(id)) &&
        Number(id) > 0;

      if (!idValido) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID do produto inválido."
        });
      }

      const temNome = nome !== undefined;
      const temCategoria = categoria !== undefined;
      const temPreco = preco !== undefined;
      const temAtivo = ativo !== undefined;

      if (!temNome && !temCategoria && !temPreco && !temAtivo) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe os dados que deseja alterar."
        });
      }

      if (
        temNome &&
        (
          typeof nome !== "string" ||
          !nome.trim() ||
          nome.trim().length > 150
        )
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe um nome válido de até 150 caracteres."
        });
      }

      if (
        temCategoria &&
        (
          typeof categoria !== "string" ||
          !categoria.trim() ||
          categoria.trim().length > 100
        )
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe uma categoria válida de até 100 caracteres."
        });
      }

      if (
        temPreco &&
        (
          preco === null ||
          preco === "" ||
          !Number.isFinite(Number(preco)) ||
          Number(preco) < 0 ||
          Number(preco) > 999999
        )
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe um preço entre R$ 0,00 e R$ 999.999,00."
        });
      }

      if (temAtivo && typeof ativo !== "boolean") {
        return res.status(400).json({
          sucesso: false,
          mensagem: "O campo ativo deve ser verdadeiro ou falso."
        });
      }

      const resultado = await sql`
        UPDATE produtos
        SET
          nome = COALESCE(
            ${temNome ? nome.trim() : null},
            nome
          ),
          categoria = COALESCE(
            ${temCategoria ? categoria.trim() : null},
            categoria
          ),
          preco = COALESCE(
            ${temPreco ? Number(preco) : null},
            preco
          ),
          ativo = COALESCE(
            ${temAtivo ? ativo : null},
            ativo
          )
        WHERE id = ${Number(id)}
        RETURNING
          id,
          nome,
          categoria,
          preco,
          ativo,
          criado_em
      `;

      if (resultado.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Produto não encontrado."
        });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: temAtivo && !temNome && !temCategoria && !temPreco
          ? (ativo ? "Produto ativado com sucesso!" : "Produto desativado com sucesso!")
          : "Produto atualizado com sucesso!",
        produto: resultado[0]
      });
    }

    // ==========================================
    // EXCLUSÃO SEGURA
    // Não apaga o registro: desativa o produto.
    // Isso ajuda a preservar o histórico de vendas.
    // ==========================================

    if (req.method === "DELETE") {
      const valorId = req.query?.id;
      const id = Number(valorId);

      if (
        valorId === undefined ||
        valorId === null ||
        String(valorId).trim() === "" ||
        !Number.isSafeInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID do produto inválido."
        });
      }

      const resultado = await sql`
        UPDATE produtos
        SET ativo = FALSE
        WHERE id = ${id}
        RETURNING id, nome, categoria, preco, ativo
      `;

      if (resultado.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Produto não encontrado."
        });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: "Produto desativado. O histórico foi preservado.",
        produto: resultado[0]
      });
    }
  } catch (erro) {
    console.error("Erro ao gerenciar produtos:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro interno ao gerenciar produtos."
    });
  }
}

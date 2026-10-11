
import { neon } from "@neondatabase/serverless";
import { exigirDono } from "./dono-auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const metodosPermitidos = ["GET", "POST", "PUT", "DELETE"];
  res.setHeader("Allow", metodosPermitidos.join(", "));

  if (!metodosPermitidos.includes(req.method)) {
    return res.status(405).json({
      sucesso: false,
      mensagem: "Método não permitido."
    });
  }

  try {
    if (!exigirDono(req, res)) {
      return;
    }

    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL não configurada.");

      return res.status(500).json({
        sucesso: false,
        mensagem: "A conexão com o banco não está configurada."
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    // LISTAR PRODUTOS
    if (req.method === "GET") {
      const produtos = await sql`
        SELECT
          id,
          nome,
          categoria,
          preco,
          imagem_url,
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

    // CADASTRAR PRODUTO
    if (req.method === "POST") {
      const { nome, categoria, preco, imagem_url } = req.body || {};

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

      const imagem = validarImagem(imagem_url);

      if (!nomeValido || !categoriaValida || !precoValido || !imagem.valida) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Confira o nome, a categoria, o preço e o endereço da imagem."
        });
      }

      const resultado = await sql`
        INSERT INTO produtos (
          nome,
          categoria,
          preco,
          imagem_url,
          ativo
        )
        VALUES (
          ${nome.trim()},
          ${categoria.trim()},
          ${Number(preco)},
          ${imagem.valor},
          TRUE
        )
        RETURNING
          id, nome, categoria, preco, imagem_url, ativo, criado_em
      `;

      return res.status(201).json({
        sucesso: true,
        mensagem: "Produto cadastrado com sucesso!",
        produto: resultado[0]
      });
    }

    // EDITAR PRODUTO
    if (req.method === "PUT") {
      const { id, nome, categoria, preco, imagem_url, ativo } = req.body || {};

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
      const temImagem = imagem_url !== undefined;
      const temAtivo = ativo !== undefined;

      if (!temNome && !temCategoria && !temPreco && !temImagem && !temAtivo) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe os dados que deseja alterar."
        });
      }

      if (temNome && (
        typeof nome !== "string" ||
        !nome.trim() ||
        nome.trim().length > 150
      )) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe um nome válido de até 150 caracteres."
        });
      }

      if (temCategoria && (
        typeof categoria !== "string" ||
        !categoria.trim() ||
        categoria.trim().length > 100
      )) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe uma categoria válida de até 100 caracteres."
        });
      }

      if (temPreco && (
        preco === null ||
        preco === "" ||
        !Number.isFinite(Number(preco)) ||
        Number(preco) < 0 ||
        Number(preco) > 999999
      )) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe um preço válido."
        });
      }

      if (temAtivo && typeof ativo !== "boolean") {
        return res.status(400).json({
          sucesso: false,
          mensagem: "O campo ativo deve ser verdadeiro ou falso."
        });
      }

      const imagem = temImagem ? validarImagem(imagem_url) : null;

      if (imagem && !imagem.valida) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe um endereço de imagem HTTP ou HTTPS válido, ou deixe vazio."
        });
      }

      const resultado = await sql`
        UPDATE produtos
        SET
          nome = COALESCE(${temNome ? nome.trim() : null}, nome),
          categoria = COALESCE(${temCategoria ? categoria.trim() : null}, categoria),
          preco = COALESCE(${temPreco ? Number(preco) : null}, preco),
          imagem_url = CASE
            WHEN ${temImagem} THEN ${imagem?.valor ?? null}
            ELSE imagem_url
          END,
          ativo = COALESCE(${temAtivo ? ativo : null}, ativo)
        WHERE id = ${Number(id)}
        RETURNING
          id, nome, categoria, preco, imagem_url, ativo, criado_em
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

    // DESATIVAR PRODUTO, PRESERVANDO O HISTÓRICO
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
        RETURNING id, nome, categoria, preco, imagem_url, ativo
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

function validarImagem(valor) {
  if (valor === undefined || valor === null || valor === "") {
    return { valida: true, valor: null };
  }

  if (typeof valor !== "string" || valor.length > 2000) {
    return { valida: false, valor: null };
  }

  try {
    const url = new URL(valor.trim());

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { valida: false, valor: null };
    }

    return { valida: true, valor: url.href };
  } catch {
    return { valida: false, valor: null };
  }
}

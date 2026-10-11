
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
      return res.status(500).json({
        sucesso: false,
        mensagem: "A conexão com o banco não está configurada."
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    // LISTAR COMPLEMENTOS
    if (req.method === "GET") {
      const complementos = await sql`
        SELECT id, nome, preco, ativo, criado_em
        FROM complementos
        ORDER BY id DESC
      `;

      return res.status(200).json({
        sucesso: true,
        complementos
      });
    }

    // CADASTRAR COMPLEMENTO
    if (req.method === "POST") {
      const { nome, preco } = req.body || {};

      const nomeValido =
        typeof nome === "string" &&
        nome.trim().length > 0 &&
        nome.trim().length <= 150;

      const precoValido =
        preco !== undefined &&
        preco !== null &&
        preco !== "" &&
        Number.isFinite(Number(preco)) &&
        Number(preco) >= 0 &&
        Number(preco) <= 999999;

      if (!nomeValido || !precoValido) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe um nome válido e um preço entre R$ 0,00 e R$ 999.999,00."
        });
      }

      const resultado = await sql`
        INSERT INTO complementos (nome, preco, ativo)
        VALUES (${nome.trim()}, ${Number(preco)}, TRUE)
        RETURNING id, nome, preco, ativo, criado_em
      `;

      return res.status(201).json({
        sucesso: true,
        mensagem: "Complemento cadastrado com sucesso!",
        complemento: resultado[0]
      });
    }

    // EDITAR OU ATIVAR/DESATIVAR
    if (req.method === "PUT") {
      const { id, nome, preco, ativo } = req.body || {};
      const numeroId = Number(id);

      if (
        id === undefined ||
        id === null ||
        String(id).trim() === "" ||
        !Number.isSafeInteger(numeroId) ||
        numeroId <= 0
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID do complemento inválido."
        });
      }

      const temNome = nome !== undefined;
      const temPreco = preco !== undefined;
      const temAtivo = ativo !== undefined;

      if (!temNome && !temPreco && !temAtivo) {
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
          mensagem: "Informe um preço válido."
        });
      }

      if (temAtivo && typeof ativo !== "boolean") {
        return res.status(400).json({
          sucesso: false,
          mensagem: "O campo ativo deve ser verdadeiro ou falso."
        });
      }

      const resultado = await sql`
        UPDATE complementos
        SET
          nome = COALESCE(
            ${temNome ? nome.trim() : null},
            nome
          ),
          preco = COALESCE(
            ${temPreco ? Number(preco) : null},
            preco
          ),
          ativo = COALESCE(
            ${temAtivo ? ativo : null},
            ativo
          )
        WHERE id = ${numeroId}
        RETURNING id, nome, preco, ativo, criado_em
      `;

      if (resultado.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Complemento não encontrado."
        });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: "Complemento atualizado com sucesso!",
        complemento: resultado[0]
      });
    }

    // EXCLUSÃO SEGURA: DESATIVA O COMPLEMENTO
    if (req.method === "DELETE") {
      const valorId = req.query?.id;
      const numeroId = Number(valorId);

      if (
        valorId === undefined ||
        valorId === null ||
        String(valorId).trim() === "" ||
        !Number.isSafeInteger(numeroId) ||
        numeroId <= 0
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID do complemento inválido."
        });
      }

      const resultado = await sql`
        UPDATE complementos
        SET ativo = FALSE
        WHERE id = ${numeroId}
        RETURNING id, nome, preco, ativo
      `;

      if (resultado.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Complemento não encontrado."
        });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: "Complemento desativado. O registro foi preservado.",
        complemento: resultado[0]
      });
    }
  } catch (erro) {
    console.error("Erro ao gerenciar complementos:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro interno ao gerenciar complementos."
    });
  }
}

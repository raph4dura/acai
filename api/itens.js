
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      sucesso: false,
      erro: 'Método não permitido.'
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não está configurada.');
    }

    const sql = neon(process.env.DATABASE_URL);

    const {
      pedido_id,
      produto,
      quantidade,
      detalhes,
      preco
    } = req.body || {};

    const idPedido = Number(pedido_id);
    const qtd = Number(quantidade);
    const valor = Number(preco);

    if (!Number.isInteger(idPedido) || idPedido < 1) {
      return res.status(400).json({
        sucesso: false,
        erro: 'ID do pedido inválido.'
      });
    }

    if (typeof produto !== 'string' || !produto.trim()) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Informe o nome do produto.'
      });
    }

    if (!Number.isInteger(qtd) || qtd < 1) {
      return res.status(400).json({
        sucesso: false,
        erro: 'A quantidade deve ser um inteiro positivo.'
      });
    }

    if (!Number.isFinite(valor) || valor < 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Preço inválido.'
      });
    }

    const resultado = await sql`
      INSERT INTO pedido_itens (
        pedido_id,
        produto,
        quantidade,
        detalhes,
        preco
      )
      VALUES (
        ${idPedido},
        ${produto.trim()},
        ${qtd},
        ${detalhes || null},
        ${valor}
      )
      RETURNING *;
    `;

    return res.status(201).json({
      sucesso: true,
      item: resultado[0]
    });
  } catch (erro) {
    console.error('Erro em itens.js:', erro.message);

    return res.status(500).json({
      sucesso: false,
      erro: 'Não foi possível cadastrar o item.'
    });
  }
}

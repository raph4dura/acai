
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não está configurada.');
    }

    const sql = neon(process.env.DATABASE_URL);

    if (req.method === 'GET') {
      const pedidos = await sql`
        SELECT *
        FROM pedidos
        ORDER BY criado_em DESC NULLS LAST, id DESC
      `;

      return res.status(200).json({
        sucesso: true,
        pedidos
      });
    }

    if (req.method === 'POST') {
      const {
        numero_pedido,
        mesa,
        pagamento,
        observacao,
        total
      } = req.body || {};

      const numero = Number(numero_pedido);
      const numeroMesa = Number(mesa);
      const valorTotal = Number(total);

      if (
        !Number.isInteger(numero) || numero < 1 ||
        !Number.isInteger(numeroMesa) || numeroMesa < 1 ||
        !Number.isFinite(valorTotal) || valorTotal < 0
      ) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Número do pedido, mesa ou total inválido.'
        });
      }

      const resultado = await sql`
        INSERT INTO pedidos (
          numero_pedido,
          mesa,
          status,
          pagamento,
          observacao,
          total,
          criado_em
        )
        VALUES (
          ${numero},
          ${numeroMesa},
          'novo',
          ${pagamento || null},
          ${observacao || null},
          ${valorTotal},
          CURRENT_TIMESTAMP
        )
        RETURNING *;
      `;

      return res.status(201).json({
        sucesso: true,
        pedido: resultado[0]
      });
    }

    res.setHeader('Allow', 'GET, POST');

    return res.status(405).json({
      sucesso: false,
      erro: 'Método não permitido.'
    });
  } catch (erro) {
    console.error('Erro em pedidos.js:', erro.message);

    return res.status(500).json({
      sucesso: false,
      erro: 'Não foi possível processar os pedidos.'
    });
  }
}

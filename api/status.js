
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');

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
    const { id, status } = req.body || {};
    const idPedido = Number(id);

    const statusValidos = [
      'novo',
      'em_preparo',
      'pronto'
    ];

    if (!Number.isInteger(idPedido) || idPedido < 1) {
      return res.status(400).json({
        sucesso: false,
        erro: 'ID do pedido inválido.'
      });
    }

    if (!statusValidos.includes(status)) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Status inválido.'
      });
    }

    const resultado = await sql`
      UPDATE pedidos
      SET
        status = ${status},
        iniciado_em = CASE
          WHEN ${status} = 'em_preparo'
            AND iniciado_em IS NULL
          THEN CURRENT_TIMESTAMP
          ELSE iniciado_em
        END,
        pronto_em = CASE
          WHEN ${status} = 'pronto'
            AND pronto_em IS NULL
          THEN CURRENT_TIMESTAMP
          ELSE pronto_em
        END
      WHERE id = ${idPedido}
      RETURNING *;
    `;

    if (resultado.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Pedido não encontrado.'
      });
    }

    return res.status(200).json({
      sucesso: true,
      pedido: resultado[0]
    });
  } catch (erro) {
    console.error('Erro em status.js:', erro.message);

    return res.status(500).json({
      sucesso: false,
      erro: 'Não foi possível atualizar o status.'
    });
  }
}

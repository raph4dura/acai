import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

export default async function handler(req, res) {

  if (req.method !== 'PUT') {
    return res.status(405).json({
      erro: 'Método não permitido'
    });
  }

  try {

    const { id, status } = req.body;

    const statusValidos = [
      'novo',
      'em_preparo',
      'pronto'
    ];

    if (!statusValidos.includes(status)) {
      return res.status(400).json({
        erro: 'Status inválido'
      });
    }

    const resultado = await sql`
      UPDATE pedidos
      SET
        status = ${status},
        iniciado_em = CASE
          WHEN ${status} = 'em_preparo' THEN CURRENT_TIMESTAMP
          ELSE iniciado_em
        END,
        pronto_em = CASE
          WHEN ${status} = 'pronto' THEN CURRENT_TIMESTAMP
          ELSE pronto_em
        END
      WHERE id = ${id}
      RETURNING *;
    `;

    if (resultado.length === 0) {
      return res.status(404).json({
        erro: 'Pedido não encontrado'
      });
    }

    return res.status(200).json({
      sucesso: true,
      pedido: resultado[0]
    });

  } catch (erro) {

    console.error(erro);

    return res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
}

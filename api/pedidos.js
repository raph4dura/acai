
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');

    return res.status(405).json({
      sucesso: false,
      erro: 'Método não permitido.'
    });
  }

  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      return res.status(500).json({
        sucesso: false,
        erro: 'A variável DATABASE_URL não está configurada.'
      });
    }

    const sql = neon(databaseUrl);

    // CONSULTAR PEDIDOS
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

    // CADASTRAR PEDIDO
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
        erro: 'Número do pedido, mesa ou total inválido.',
        recebido: {
          numero_pedido,
          mesa,
          total
        }
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
      RETURNING *
    `;

    return res.status(201).json({
      sucesso: true,
      pedido: resultado[0]
    });

  } catch (erro) {
    // Detalhes no log da função da Vercel
    console.error('Erro em api/pedidos.js:', erro);

    return res.status(500).json({
      sucesso: false,
      erro: 'Falha ao processar o pedido.',
      detalhe: erro?.message || String(erro)
    });
  }
}

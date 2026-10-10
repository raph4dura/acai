
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

function hashPin(pin) {
  return createHash('sha256').update(pin).digest('hex');
}

function chaveTentativa(ip, pedidoId) {
  return createHash('sha256')
    .update(`${ip}:${pedidoId}`)
    .digest('hex');
}

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
    const { id, status, pin } = req.body || {};
    const idPedido = Number(id);

    if (!Number.isInteger(idPedido) || idPedido < 1) {
      return res.status(400).json({
        sucesso: false,
        erro: 'ID do pedido inválido.'
      });
    }

    if (!['em_preparo', 'pronto'].includes(status)) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Status inválido.'
      });
    }

    let funcionarioId = null;

    // O PIN é obrigatório para iniciar o preparo.
    if (status === 'em_preparo') {
      if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Digite um PIN de quatro dígitos.'
        });
      }

      const ip = (req.headers['x-forwarded-for'] || 'desconhecido')
        .toString()
        .split(',')[0]
        .trim();

      const chave = chaveTentativa(ip, idPedido);

      const registros = await sql`
        SELECT tentativas, bloqueado_ate, CURRENT_TIMESTAMP AS agora
        FROM tentativas_pin
        WHERE chave = ${chave}
      `;

      if (registros.length > 0) {
        const registro = registros[0];

        if (
          registro.bloqueado_ate &&
          new Date(registro.bloqueado_ate) > new Date(registro.agora)
        ) {
          return res.status(429).json({
            sucesso: false,
            erro: 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.'
          });
        }

        if (
          registro.bloqueado_ate &&
          new Date(registro.bloqueado_ate) <= new Date(registro.agora)
        ) {
          await sql`
            UPDATE tentativas_pin
            SET tentativas = 0,
                bloqueado_ate = NULL,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE chave = ${chave}
          `;
        }
      }

      const funcionarios = await sql`
        SELECT id, nome
        FROM funcionarios
        WHERE pin_hash = ${hashPin(pin)}
          AND ativo = TRUE
      `;

      if (funcionarios.length !== 1) {
        const tentativas = await sql`
          INSERT INTO tentativas_pin (chave, tentativas)
          VALUES (${chave}, 1)
          ON CONFLICT (chave)
          DO UPDATE SET
            tentativas = tentativas_pin.tentativas + 1,
            atualizado_em = CURRENT_TIMESTAMP
          RETURNING tentativas
        `;

        if (tentativas[0].tentativas >= 5) {
          await sql`
            UPDATE tentativas_pin
            SET bloqueado_ate = CURRENT_TIMESTAMP + INTERVAL '15 minutes',
                atualizado_em = CURRENT_TIMESTAMP
            WHERE chave = ${chave}
          `;
        }

        return res.status(
          tentativas[0].tentativas >= 5 ? 429 : 401
        ).json({
          sucesso: false,
          erro: tentativas[0].tentativas >= 5
            ? 'Muitas tentativas. Aguarde 15 minutos.'
            : 'PIN inválido.'
        });
      }

      funcionarioId = funcionarios[0].id;

      await sql`
        UPDATE tentativas_pin
        SET tentativas = 0,
            bloqueado_ate = NULL,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE chave = ${chave}
      `;
    }

    let resultado;

    if (status === 'em_preparo') {
      resultado = await sql`
        UPDATE pedidos
        SET status = 'em_preparo',
            funcionario_id = ${funcionarioId},
            iniciado_em = COALESCE(iniciado_em, CURRENT_TIMESTAMP)
        WHERE id = ${idPedido}
          AND status = 'novo'
        RETURNING *
      `;
    } else {
      resultado = await sql`
        UPDATE pedidos
        SET status = 'pronto',
            pronto_em = COALESCE(pronto_em, CURRENT_TIMESTAMP)
        WHERE id = ${idPedido}
          AND status = 'em_preparo'
        RETURNING *
      `;
    }

    if (resultado.length === 0) {
      return res.status(409).json({
        sucesso: false,
        erro: 'O pedido não foi encontrado ou seu status já foi alterado.'
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

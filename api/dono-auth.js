
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'dono_sessao';
const DURACAO_SEGUNDOS = 8 * 60 * 60;

function assinar(expiracao) {
    return createHmac('sha256', process.env.DONO_TOKEN_SECRET)
        .update(String(expiracao))
        .digest('hex');
}

function cookieValor(req) {
    const cookies = (req.headers.cookie || '').split(';');

    const linha = cookies.find(item =>
        item.trim().startsWith(`${COOKIE}=`)
    );

    return linha ? linha.trim().slice(COOKIE.length + 1) : '';
}

function sessaoValida(req) {
    if (!process.env.DONO_TOKEN_SECRET) return false;

    const partes = cookieValor(req).split('.');
    if (partes.length !== 2) return false;

    const [expiracaoTexto, assinaturaRecebida] = partes;
    const expiracao = Number(expiracaoTexto);

    if (
        !Number.isInteger(expiracao) ||
        expiracao <= Math.floor(Date.now() / 1000) ||
        !/^[a-f0-9]{64}$/.test(assinaturaRecebida)
    ) {
        return false;
    }

    const assinaturaEsperada = assinar(expiracao);
    const recebida = Buffer.from(assinaturaRecebida, 'hex');
    const esperada = Buffer.from(assinaturaEsperada, 'hex');

    return recebida.length === esperada.length &&
        timingSafeEqual(recebida, esperada);
}

export function exigirDono(req, res) {
    if (!sessaoValida(req)) {
        res.status(401).json({
            sucesso: false,
            erro: 'Sessão do dono inválida ou expirada. Entre novamente.'
        });

        return false;
    }

    return true;
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (!process.env.DONO_SENHA || !process.env.DONO_TOKEN_SECRET) {
        return res.status(500).json({
            sucesso: false,
            erro: 'Configure DONO_SENHA e DONO_TOKEN_SECRET na Vercel.'
        });
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            sucesso: true,
            autenticado: sessaoValida(req)
        });
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');

        return res.status(405).json({
            sucesso: false,
            erro: 'Método não permitido.'
        });
    }

    const { acao, senha } = req.body || {};

    if (acao === 'sair') {
        res.setHeader(
            'Set-Cookie',
            `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0`
        );

        return res.status(200).json({ sucesso: true });
    }

    if (acao !== 'entrar' || typeof senha !== 'string') {
        return res.status(400).json({
            sucesso: false,
            erro: 'Solicitação de autenticação inválida.'
        });
    }

    const senhaCorreta = Buffer.from(process.env.DONO_SENHA);
    const senhaRecebida = Buffer.from(senha);

    const senhaValida =
        senhaCorreta.length === senhaRecebida.length &&
        timingSafeEqual(senhaCorreta, senhaRecebida);

    if (!senhaValida) {
        return res.status(401).json({
            sucesso: false,
            erro: 'Senha incorreta.'
        });
    }

    const expiracao = Math.floor(Date.now() / 1000) + DURACAO_SEGUNDOS;
    const assinatura = assinar(expiracao);

    res.setHeader(
        'Set-Cookie',
        `${COOKIE}=${expiracao}.${assinatura}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${DURACAO_SEGUNDOS}`
    );

    return res.status(200).json({
        sucesso: true,
        autenticado: true
    });
}

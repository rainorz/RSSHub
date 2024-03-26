import { Route } from '@/types';
import { load } from 'cheerio';
import got from '@/utils/got';
import cache from '@/utils/cache';
import iconv from 'iconv-lite';

export const route: Route = {
    path: '/:path/:page?',
    name: 'CMB CreditCard Notice',
    maintainers: ['rainorz'],
    handler,
};

async function handler(ctx) {
    const page = ctx.req.param('page') ?? '1';
    const baseUrl = 'https://cc.cmbchina.com';
    const listUrl = `${baseUrl}/notice/${page}/`;
    const response = await got(listUrl, {
        responseType: 'buffer',
    });

    const $ = load(iconv.decode(response.data, 'utf-8'));

    const list = $('.libg')
        .map((_, item) => {
            item = $(item);
            const notice = item.find('.graynotice');
            return {
                title: notice.text(),
                link: baseUrl + notice.attr('href'),
                pubDate: item.find('.c_date').text(),
            };
        })
        .get();
    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await got(item.link, {
                    responseType: 'buffer',
                });

                const content = load(iconv.decode(detailResponse.data, 'utf-8'));
                const desc = content('.info').html();
                item.description = desc;

                return item;
            })
        )
    );
    return {
        title: $('title').text(),
        link: listUrl,
        item: items,
    };
}

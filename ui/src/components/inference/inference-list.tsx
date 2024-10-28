'use client';

import React, { Suspense } from 'react';

import { Badge, Table } from 'flowbite-react';
import SimpleBar from 'simplebar-react';

import { useInferencesSuspenseQuery } from './hooks';
import { Inference } from './state';

const InferenceContent = () => {
  const { data } = useInferencesSuspenseQuery();

  return (
    <Table.Body className='divide-y divide-border dark:divide-darkborder'>
      {data.items.map((item: Inference) => (
        <Table.Row key={item.id}>
          <Table.Cell className='whitespace-nowrap'>
            <div className='me-5'>
              <p className='text-base'>{item.createdAt.toLocaleString()}</p>
            </div>
          </Table.Cell>
          <Table.Cell className='whitespace-nowrap'>
            {item.decision === 'buy' && <Badge className='text-success bg-lightsuccess'>{item.decision}</Badge>}
            {item.decision === 'hold' && <Badge className='text-warning bg-lightwarning'>{item.decision}</Badge>}
            {item.decision === 'sell' && <Badge className='text-error bg-lighterror'>{item.decision}</Badge>}
          </Table.Cell>
          <Table.Cell>
            <h4>{item.rate * 100}%</h4>
          </Table.Cell>
          <Table.Cell className='whitespace-nowrap'>
            <div className='me-5'>
              <p className='text-base'>{item.reason}</p>
            </div>
          </Table.Cell>
          <Table.Cell className='whitespace-nowrap'>
            <div className='me-5'>
              <p className='text-base'>{item.reflection}</p>
            </div>
          </Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
  );
};

const InferenceSkeleton = () => {
  return (
    <Table.Body className='divide-y divide-border dark:divide-darkborder'>
      <Table.Row>
        <Table.Cell>로딩 중...</Table.Cell>
      </Table.Row>
    </Table.Body>
  );
};

const InferenceList = () => {
  return (
    <>
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray pt-6 px-0 relative w-full break-words'>
        <div className='px-6'>
          <h5 className='card-title mb-6'>추론 목록</h5>
        </div>
        <SimpleBar>
          <div className='overflow-x-auto'>
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell className='whitespace-nowrap'>매매 날짜</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>투자 의견</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>투자 비율</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>투자 사유</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>재판단 사유</Table.HeadCell>
              </Table.Head>
              <Suspense fallback={<InferenceSkeleton />}>
                <InferenceContent />
              </Suspense>
            </Table>
          </div>
        </SimpleBar>
      </div>
    </>
  );
};

export default InferenceList;

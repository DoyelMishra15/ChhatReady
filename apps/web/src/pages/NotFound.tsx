import { ErrorState } from '../components/ErrorState';
import { LinkButton } from '../components/ui/button';

export default function NotFound() {
  return (
    <div className="container-page py-16">
      <ErrorState title="This page does not exist" message="The link may be mistyped or out of date." actions={<LinkButton to="/">Go to the start</LinkButton>} />
    </div>
  );
}

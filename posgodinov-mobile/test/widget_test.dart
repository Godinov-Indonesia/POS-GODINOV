import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/main.dart';

void main() {
  testWidgets('POS Godinov App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const PosGodinovApp());

    // Verify that our placeholder page is shown.
    expect(find.text('POS Godinov — scaffold M0'), findsOneWidget);
  });
}
